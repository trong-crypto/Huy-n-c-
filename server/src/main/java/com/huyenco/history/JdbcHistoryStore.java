package com.huyenco.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.knowledge.KnowledgeAccessException;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;

/** Owner predicates are mandatory on every history SELECT/DELETE; save limit is serialized per owner. */
public final class JdbcHistoryStore implements HistoryStore {
    private final DataSource source;
    private final ObjectMapper mapper;
    public JdbcHistoryStore(DataSource source,ObjectMapper mapper) { this.source=source; this.mapper=mapper; }
    @Override public Owner create(String hash,Instant now,Instant expires) {
        return run(false,c->{
            UUID id=UUID.randomUUID();
            try(var s=prepare(c,"INSERT INTO anonymous_sessions(owner_id,token_hash,created_at,expires_at) VALUES (?,?,?,?)")) {
                s.setObject(1,id);s.setString(2,hash);s.setTimestamp(3,Timestamp.from(now));s.setTimestamp(4,Timestamp.from(expires));s.executeUpdate();
            }
            return new Owner(id,expires);
        });
    }
    @Override public Optional<Owner> owner(String hash,Instant now) {
        return run(true,c->{try(var s=prepare(c,"SELECT owner_id,expires_at FROM anonymous_sessions WHERE token_hash=? AND expires_at>?")) {
            s.setString(1,hash);s.setTimestamp(2,Timestamp.from(now));
            try(var r=s.executeQuery()) {return r.next()?Optional.of(new Owner(r.getObject(1,UUID.class),r.getTimestamp(2).toInstant())):Optional.empty();}
        }});
    }
    @Override public Optional<Detail> byRequest(UUID owner,UUID request) {
        return find("interpretation_history",owner,request,"calculation_request_id");
    }
    @Override public Optional<Detail> byRequest(Owner owner,UUID request) {
        return find(table(owner),owner.id(),request,"calculation_request_id");
    }
    @Override public Optional<Detail> detail(UUID owner,UUID id) { return find("interpretation_history",owner,id,"id"); }
    @Override public Optional<Detail> detail(Owner owner,UUID id) { return find(table(owner),owner.id(),id,"id"); }
    private Optional<Detail> find(String table,UUID owner,UUID id,String column) {
        return run(true,c->{try(var s=prepare(c,"SELECT * FROM "+table+" WHERE owner_id=? AND "+column+"=?")) {
            s.setObject(1,owner);s.setObject(2,id);try(var r=s.executeQuery()) {return r.next()?Optional.of(detail(r)):Optional.empty();}
        }});
    }
    @Override public Detail save(Owner owner,UUID request,CompletedResults.Result result,String title,Instant now,int limit) {
        String table=table(owner);
        return run(false,c->{
            lockOwner(c,owner,now);
            try(var existing=prepare(c,"SELECT * FROM "+table+" WHERE owner_id=? AND calculation_request_id=?")) {
                existing.setObject(1,owner.id());existing.setObject(2,request);
                try(var r=existing.executeQuery()) {if(r.next())return detail(r);}
            }
            try(var count=prepare(c,"SELECT count(*) FROM "+table+" WHERE owner_id=?")) {
                count.setObject(1,owner.id());try(var r=count.executeQuery()) {r.next();if(r.getInt(1)>=limit)throw SessionService.invalid("Đã đạt giới hạn lịch sử của phiên.");}
            }
            try(var s=prepare(c,"INSERT INTO "+table+"(id,owner_id,calculation_request_id,calculation_type,title,created_at,rule_basis,result_snapshot) VALUES (?,?,?,?,?,?,?,?::jsonb) RETURNING *")) {
                s.setObject(1,UUID.randomUUID());s.setObject(2,owner.id());s.setObject(3,request);s.setString(4,result.type());s.setString(5,title);
                s.setTimestamp(6,Timestamp.from(now));s.setString(7,result.basis());s.setString(8,result.json());
                try(var r=s.executeQuery()) {r.next();return detail(r);}
            }
        });
    }
    private static String table(Owner owner) { return owner.account() ? "account_history" : "interpretation_history"; }
    private static void lockOwner(Connection c,Owner owner,Instant now)throws SQLException {
        if (owner.account()) {
            try(var account=prepare(c,"SELECT id FROM accounts WHERE id=? AND status='ACTIVE' AND role IN ('USER','CONSULTANT') FOR UPDATE")) {
                account.setObject(1,owner.id());
                try(var r=account.executeQuery()) {if(!r.next())throw SessionService.loginRequired();}
            }
            try(var session=prepare(c,"SELECT id FROM account_sessions WHERE id=? AND account_id=? AND realm='CUSTOMER' AND revoked_at IS NULL AND expires_at>? FOR UPDATE")) {
                session.setObject(1,owner.accountSessionId());session.setObject(2,owner.id());session.setTimestamp(3,Timestamp.from(now));
                try(var r=session.executeQuery()) {if(!r.next())throw SessionService.loginRequired();}
            }
        } else {
            try(var lock=prepare(c,"SELECT owner_id FROM anonymous_sessions WHERE owner_id=? AND expires_at>? FOR UPDATE")) {
                lock.setObject(1,owner.id());lock.setTimestamp(2,Timestamp.from(now));
                try(var r=lock.executeQuery()) {if(!r.next())throw SessionService.invalidSession();}
            }
        }
    }
    @Override public Page list(UUID owner,String query,String type,int page,int size) {
        return list("interpretation_history",owner,query,type,page,size);
    }
    @Override public Page list(Owner owner,String query,String type,int page,int size) {
        return list(table(owner),owner.id(),query,type,page,size);
    }
    private Page list(String table,UUID owner,String query,String type,int page,int size) {
        return run(true,c->{
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            String filter=" FROM "+table+" WHERE owner_id=? AND strpos(lower(title),lower(?))>0"+(type==null?"":" AND calculation_type=?");
            long total;
            try(var s=prepare(c,"SELECT count(*)"+filter)) {
                params(s,owner,query,type);try(var r=s.executeQuery()){r.next();total=r.getLong(1);}
            }
            var items=new ArrayList<Item>();
            try(var s=prepare(c,"SELECT id,calculation_type,title,created_at,rule_basis"+filter+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?")) {
                int position=params(s,owner,query,type);s.setInt(position++,size);s.setLong(position,(long)page*size);
                try(var r=s.executeQuery()){while(r.next())items.add(new Item(r.getObject("id",UUID.class),r.getString("calculation_type"),r.getString("title"),r.getTimestamp("created_at").toInstant(),r.getString("rule_basis")));}
            }
            return new Page(List.copyOf(items),page,size,total,(total+size-1)/size);
        });
    }
    private static int params(PreparedStatement s,UUID owner,String query,String type)throws SQLException {
        s.setObject(1,owner);s.setString(2,query);if(type!=null){s.setString(3,type);return 4;}return 3;
    }
    @Override public boolean delete(UUID owner,UUID id) {
        return delete("interpretation_history",owner,id);
    }
    @Override public boolean delete(Owner owner,UUID id) { return delete(table(owner),owner.id(),id); }
    private boolean delete(String table,UUID owner,UUID id) {
        return run(false,c->{try(var s=prepare(c,"DELETE FROM "+table+" WHERE owner_id=? AND id=?")) {
            s.setObject(1,owner);s.setObject(2,id);return s.executeUpdate()==1;
        }});
    }
    private Detail detail(ResultSet r)throws Exception {
        return new Detail(r.getObject("id",UUID.class),r.getString("calculation_type"),r.getString("title"),
                r.getTimestamp("created_at").toInstant(),r.getString("rule_basis"),mapper.readTree(r.getString("result_snapshot")));
    }
    private static PreparedStatement prepare(Connection c,String sql)throws SQLException {
        var s=c.prepareStatement(sql);s.setQueryTimeout(3);return s;
    }
    private <T>T run(boolean readOnly,Query<T> query) {
        try(var c=source.getConnection()) {
            c.setReadOnly(readOnly);c.setAutoCommit(false);
            try {var value=query.run(c);c.commit();return value;}
            catch(Exception failure){c.rollback();throw failure;}
        } catch(com.huyenco.common.exception.ContractException failure) {throw failure;}
        catch(Exception failure){throw new KnowledgeAccessException();}
    }
    @FunctionalInterface private interface Query<T>{T run(Connection c)throws Exception;}
}

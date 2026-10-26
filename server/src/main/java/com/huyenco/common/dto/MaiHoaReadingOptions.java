package com.huyenco.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import static com.huyenco.common.dto.ReadingContracts.*;

/** ContractValidator validates offset, UTC+7 date range, method and unknown fields. */
public record MaiHoaReadingOptions(Topic topic, @JsonInclude(JsonInclude.Include.NON_NULL) Context context) {
    public enum Topic { GENERAL, CAREER, WEALTH, LOVE }
    public MaiHoaReadingOptions { require(topic != null, "Reading topic required"); }
    public record Context(String datetime) {
        public Context { require(text(datetime), "Explicit reading time required"); }
    }
}

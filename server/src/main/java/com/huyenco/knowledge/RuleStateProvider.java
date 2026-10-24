package com.huyenco.knowledge;

import java.util.Optional;

@FunctionalInterface
public interface RuleStateProvider {
    Optional<RuleState> find(String ruleCode);
}

package com.huyenco.knowledge;

import java.util.Set;

/** One coherent, read-only snapshot of the requested Tam The rule versions. */
public interface TamTheRepository {
    TamTheSnapshot tamThe(Set<String> ruleCodes);
}

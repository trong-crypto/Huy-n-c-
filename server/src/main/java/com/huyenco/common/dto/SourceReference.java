package com.huyenco.common.dto;

/** A book page or a versioned external algorithm source. */
public record SourceReference(String sourceId, String title, String version, String section,
                              String printedPage, Integer pdfPage, String sha256, String url) {
    public boolean hasTraceableLocation() {
        boolean identity = present(sourceId) && present(title) && present(version) && present(section);
        boolean book = pdfPage != null && pdfPage > 0 && present(printedPage)
                && sha256 != null && sha256.matches("[a-fA-F0-9]{64}");
        boolean external = url != null && url.startsWith("https://") && url.length() > 8;
        return identity && ((pdfPage != null || printedPage != null) ? book : external);
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}

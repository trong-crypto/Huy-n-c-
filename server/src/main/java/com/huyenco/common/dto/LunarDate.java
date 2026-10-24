package com.huyenco.common.dto;

/** Calendar service checks that the date actually exists, including the leap month. */
public record LunarDate(int year, int month, int day, boolean isLeapMonth) {
}

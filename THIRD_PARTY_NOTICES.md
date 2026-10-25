# Third-party notices

## Hồ Ngọc Đức — Vietnamese lunar calendar, version 0.8

Source: https://www.xemamlich.uhm.vn/JavaScript/amlich-hnd.js

The historical comparison codes in `data/c01_hnd_reference.csv`, the packed-data decoder in `VietnameseLunarCalendar.java` and Can Chi formulas in `CalendarService.java` are adapted from this source. The production date table is generated separately from Time4J astronomy with fixed UTC+7 rules; it does not use the old HND year codes. The original notice is retained below. This grant covers personal, non-commercial use, including this course project; it is not a general commercial-use license. Snapshot hashes are recorded in `data/c01_calendar_source.json`.

```text
Copyright 2004 Ho Ngoc Duc [http://come.to/duc]. All Rights Reserved.
Permission to use, copy, modify, and redistribute this software and its
documentation for personal, non-commercial use is hereby granted provided that
this copyright notice appears in all copies.
```

## Time4J 5.9.4 — independent test reference only

Project: https://github.com/MenoData/Time4J

Artifact: `net.time4j:time4j-base:5.9.4`, test scope, GNU Lesser General Public License 2.1 as declared in its parent POM. Used at build/review time by `CalendarTableGenerator`, not included in the application runtime. The generated calendar table is packaged as data. Tests also compare modern dates against Time4J's VietnameseCalendar; because the generator uses Time4J astronomy this is a cross-check within the same library, not an independent astronomical reference. HKO controls and the primary-source almanac comparison are recorded separately in the C01 handoff. Historical offset rules in VietnameseCalendar differ from this project's fixed UTC+7 convention.

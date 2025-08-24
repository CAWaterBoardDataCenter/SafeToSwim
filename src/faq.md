---
title: Frequently Asked Questions (FAQ)
---

# Frequently Asked Questions (FAQ)

This page provides further information about the Safe To Swim dashboard by category. See the [How to Use](how-to-use) page for instructions on navigating the dashboard.

## Water quality and health

Poor water quality can pose significant health risks to individuals who engage in recreational activities such as swimming, surfing, or wading. Exposure to contaminated water can lead to a variety of illnesses, particularly gastrointestinal infections, skin rashes, and respiratory issues. Vulnerable populations, including children, the elderly, and individuals with compromised immune systems, are at greater risk.

### What kind of activities are considered recreational?

Recreational activities in water bodies include swimming, surfing, wading, boating, fishing, and other water sports. These activities often involve direct contact with the water, which can increase the risk of exposure to harmful bacteria and pathogens if the water quality is poor.

### What are "indicator bacteria"?

The term *indicator bacteria* refers to bacteria used to assess the safety of recreational waters. They are not necessarily harmful themselves but indicate the potential presence of pathogens, especially those that can cause gastrointestinal illness from coming into contact with or ingesting contaminated water. Common fecal indicator bacteria include E. coli and enterococcus, which are found in the intestines of warm-blooded animals and can signal fecal contamination in water. This map uses these indicator bacteria to evaluate water quality and determine safety for recreational activities.

## Data sources and collection

### Where does this dashboard get its water quality data?

The data shown on this map are sourced from the [California Environmental Data Exchange Network (CEDEN)](http://www.ceden.org/), [BeachWatch](https://www.waterboards.ca.gov/water_issues/programs/beaches/search_beach_mon.html) database, and [Lower American River E. coli Monitoring Results](https://arcg.is/0ea0zq) interactive map. Data from the Lower American River area is also included in the CEDEN database, but this data is updated more frequently in the Lower American River E. coli Monitoring Results interactive map.

TODO: which databases are publicly accessible?

### How is the data collected?

Most samples are collected by local public health agencies, environmental organizations, and other partners. Samples are typically obtained via grab sampling at designated stations along beaches, rivers, and lakes. The samples are then analyzed in laboratories to measure levels of indicator bacteria such as E. coli and enterococcus. 

### Why do I see different units (CFU vs MPN) for bacteria concentrations?

Methods for reporting concentrations and detection limits may vary by agency. For example, some may report concentrations in CFU/100mL (colony forming units per 100 milliliters) while others may use MPN/100mL (most probable number per 100 milliliters). The methods these units represent are different, but are equivalent and acceptable units of concentration under California's water quality standards.

### How often is data updated?

Data from CEDEN and BeachWatch are regularly prepared for the Safe to Swim Map and uploaded to the California Open Data Portal by the California State Water Resources Control Board, where it is then pulled into this dashboard. Data is typically updated daily on weekdays, depending on staff availability.

### How is data processed for this dashboard?

Raw data is cleaned and validated to ensure accuracy and consistency. This involves removing duplicates, correcting errors, and standardizing formats. The processed data is then aggregated and analyzed to provide meaningful insights for the dashboard.

## Safety Statuses

### What are safety statuses, and how should I interpret them?

"Low risk" indicates that the water quality meets the established standards for recreational use, while "Use caution" suggests that the water quality may pose an elevated risk to health, and users should exercise caution when engaging in recreational activities. The "Caution" category is used when bacteria levels exceed the threshold for a single sample but do not meet the criteria for "Unsafe," which would require multiple exceedances or a higher level of contamination.

### How are safety statuses determined?

Safety statuses are determined based on the results of water quality testing and comparison to established thresholds. By the most recent [California bacteria objectives](https://www.waterboards.ca.gov/bacterialobjectives/), a station has a "Use caution" status if *either* of the following are true: 

1. More than 90% of single samples in the last six weeks exceed the single sample threshold.
2. The 30-day rolling geometric mean exceeds the geometric mean threshold. The rolling window includes samples from the past 30 days, including the most recent sample.

A station is considered "Low risk" if *both* the single sample and 30-day geometric mean are below their respective thresholds. Additionally, if there are fewer than 5 samples in the past 30 days, the station will have a "Not enough data" status.

The thresholds used for determining safety statuses also depend on the type of specific indicator bacteria. E. coli is used for freshwater sites, while enterococcus is used for marine and estuarine sites.

### Why are there only two safety status categories?

Based on the 2019 statewide bacteria water quality objectives and the large studies they are based on, there are two meaningful risk categories that can be used. While there are multiple thresholds used in calculating these statuses, these thresholds aim to simplify how we can determine if a distribution of rapidly varying bacteria concentrations poses a risk. Currently, the data and science is not able to further divide the "Use caution" category into additional levels of risk.

## Bacteria Objectives

The results displayed on this map are compared to the statewide bacteria water quality objectives, which the State Water Resources Control Board issued in 2019 to protect recreational users from the effects of pathogens in California water bodies. This section provides more information about these objectives and how they are applied.

### What does "bacteria objectives" mean?

Bacteria objectives are regulatory standards set to protect public health by limiting the concentration of certain bacteria in recreational waters. These objectives are based on scientific studies that correlate bacteria levels with the risk of illness among swimmers and other recreational users. The objectives specify acceptable levels of indicator bacteria, such as E. coli and enterococcus, which are used to assess water quality.

### What bacteria objectives are used in this dashboard?

This dashboard uses the [2019 statewide bacteria water quality objectives](https://www.waterboards.ca.gov/bacterialobjectives/) established by the State Water Resources Control Board. These objectives set specific thresholds for E. coli in freshwater and enterococcus in marine and estuarine waters.

### Are California's standards different from federal standards?

Yes, California has its own set of water quality standards that may differ from federal standards. The state often adopts more stringent regulations to protect public health and the environment. The state also may have more frequently updated standards as the understanding of measuring water quality and its impacts evolves.

### Why aren't fecal coliforms or total coliforms used in this dashboard?

Fecal coliforms and total coliforms are older indicators that have been largely replaced by E. coli and enterococcus for assessing recreational water quality. E. coli is a more specific indicator of fecal contamination from warm-blooded animals, and so is here used for freshwater sites, while enterococcus is particularly useful for marine and estuarine waters. Both E. coli and enterococcus have been shown to correlate better with the presence of pathogens that can cause illness in humans, making them more reliable indicators for protecting public health in recreational waters. See 

### What do the safety thresholds mean for health?

[Details about the numerical standards and criteria used to determine safe, caution, and unsafe levels]

## Limitations

Water quality data is inherently limited by the frequency and locations of sampling. Not all water bodies are monitored, and conditions can change rapidly due to weather, pollution events, and other factors. While this dashboard provides valuable information, it should not be the sole basis for making decisions about water recreation.

1. **Incomplete coverage:** Not all recreational water bodies in California are monitored. Some areas may lack data entirely, while others may have infrequent sampling. Users should be aware that the absence of data does not imply safety. Additionally, statuses are estimates based on point data and may not represent conditions at other locations within the same water body.

2. **Data lag:** Data is collected and processed by hand, which can introduce delays. There may be a lag of several days between sample collection and data availability on the dashboard. Users should consider this lag when interpreting the data.

3. **Weather dependencies:** Precipitation and runoff can significantly impact water quality. Heavy rains can lead to increased levels of contaminants reaching bodies of water, while dry conditions may result in lower water levels. Users should consider recent weather conditions when interpreting water quality data. In particular, avoid water contact for at least 48 hours after significant rainfall events, as runoff can carry pollutants into recreational waters. Water quality can change rapidly, and this dashboard may not reflect the most current conditions.

4. **No connection to real-time closures:** This dashboard does not provide real-time information about water closures or advisories. Users should consult local health departments or agencies for the latest information on water safety and any active closures, which are typically posted physically at the waterbody or on the agency's website. These closures may be based on additional factors not represented in this dashboard, such as sewage spills or other pollution events.

## Contact Information

Where can I get help or provide feedback?

Inquiries are welcome! Please reach out to swamp@waterboards.ca.gov with "Safe to Swim" in the subject line for technical support, data questions, or to provide feedback.

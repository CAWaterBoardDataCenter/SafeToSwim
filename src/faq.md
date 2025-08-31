---
title: Frequently Asked Questions (FAQ)
---

# Frequently Asked Questions (FAQ)

This page provides further information about the Safe To Swim dashboard by category. See the [How to Use](how-to-use) page for instructions on navigating the dashboard.

## Water quality and health

Poor water quality can pose significant health risks to recreators swimming, surfing, wading, or otherwise coming into contact with water. Exposure to contaminated water can lead to a variety of illnesses, particularly gastrointestinal infections, skin rashes, and respiratory issues. Vulnerable populations, including children, the elderly, and individuals with compromised immune systems, are at greater risk.

### What kind of activities are considered recreational?

Recreational activities here refer to water contact recreation as formally defined by the REC-1 beneficial use category, including swimming, surfing, wading, boating, fishing, and other water sports. These activities often involve direct contact with the water and the possibility of ingestion, which can increase the risk from harmful bacteria and pathogens.

### What are "indicator bacteria"?

On this dashboard, the term *indicator bacteria* refers to bacteria used to assess the safety of recreational waters. They are not necessarily harmful themselves but indicate the potential presence of pathogens associated with fecal contamination, especially those that can cause gastrointestinal illness from coming into contact with or ingesting contaminated water. Common fecal indicator bacteria include E. coli and enterococcus, which are found in the intestines of warm-blooded animals and can signal fecal contamination in water. This map uses these indicator bacteria to evaluate water quality and determine safety for recreational activities.

## Data sources and collection

### Where does this dashboard get its water quality data?

The data shown on this map are sourced from the [California Environmental Data Exchange Network (CEDEN)](http://www.ceden.org/), [BeachWatch](https://www.waterboards.ca.gov/water_issues/programs/beaches/search_beach_mon.html) database, and [Lower American River E. coli Monitoring Results](https://arcg.is/0ea0zq) interactive map. Data from the Lower American River area is also included in the CEDEN database, but this data is updated more frequently in the Lower American River E. coli Monitoring Results interactive map.

### How is the data collected?

Most samples are collected by local public health agencies, environmental organizations, and other partners. Samples are typically obtained via grab sampling at designated stations along beaches, rivers, and lakes. The samples are then analyzed in laboratories to measure levels of indicator bacteria such as E. coli and enterococcus.

There exist many methods of measuring bacteria concentrations, typically involving culturing bacteria from a water sample. Some local agencies have begun using rapid testing methods such as quantitative real-time PCR (qPCR) and droplet digital polymerase chain reaction (ddPCR). Further information about the latest studies on methodology can be found at the [U.S. EPA's website](https://www.epa.gov/water-research/monitoring-recreational-water-quality).

### Why do I see different units (CFU vs MPN) for bacteria concentrations?

Methods for reporting concentrations and detection limits may vary by region. For example, some may report concentrations in CFU/100mL (colony forming units per 100 milliliters) while others may use MPN/100mL (most probable number per 100 milliliters). The methods these two units represent are different, but are accepted as equivalent units of concentration under California's water quality standards.

### What is "ddPCR" and why do some samples have this method?

ddPCR stands for droplet digital polymerase chain reaction, describing a testing method that allows for the precise quantification of DNA in a sample. In May 2022, San Diego County became the first Federal and State approved coastal county in the nation to begin using a ddPCR testing method that offers more rapid results. For enterococcus only, this map uses the ddPCR standard threshold value of 1,413 DNA copies of bacteria per 100 mL, the same threshold value documented on the San Diego County Beach and Bay Water Quality Monitoring Program website. Results above this level may indicate a higher risk of illness.

We provide this information in the interest of transparency, but note that ddPCR is not yet widely used by other agencies in California, and the statewide bacteria water quality objectives do not yet include ddPCR thresholds for safety statuses. Safety statuses shown on this dashboard are only evaluated using culture-based methods (units of CFU or MPN).

### How often is data updated?

Data from CEDEN and BeachWatch are regularly prepared for the Safe to Swim Map and uploaded to the California Open Data Portal by the California State Water Resources Control Board, where it is then pulled into this dashboard. Data is typically updated daily on weekdays, depending on staff availability.

### How is data processed for this dashboard?

Raw data is cleaned and validated to ensure accuracy and consistency. This involves removing duplicates, correcting errors, and standardizing formats. The processed data is then aggregated and analyzed to provide meaningful insights for the dashboard.

## Safety Statuses

### What are safety statuses, and how should I interpret them?

"Low risk" indicates that the water quality meets the established standards for recreational use, while "Use caution" suggests that the water quality may pose an elevated risk to health, and users should exercise caution when engaging in recreational activities. The "Caution" category is used when bacteria levels exceed the threshold for a single sample but do not meet the criteria for "Unsafe," which would require multiple exceedances or a higher level of contamination.

### How are safety statuses evaluated?

Safety statuses are based on the results of water quality testing and comparison to established thresholds. By the most recent [California bacteria objectives](https://www.waterboards.ca.gov/bacterialobjectives/), a station has a "Use caution" status if *either* of the following are true:

1. More than 10% of single samples in the last 30 days exceed the single-sample threshold.
2. The 6-week rolling geometric mean exceeds the geometric mean threshold. The rolling window includes samples from the past 6 weeks, including the most recent sample.

A station is considered "Low risk" if *both* the single sample and 6-week geometric mean are below their respective thresholds. If there are fewer than 5 samples in the past 6 weeks, the station will have a "Not enough data" status.

The thresholds used for determining safety statuses also depend on the type of specific indicator bacteria. E. coli is used for freshwater sites, while enterococcus is used for marine and estuarine sites. For full technical details on how safety statuses are calculated, please refer the [Development Guide](development-guide#status-evaluation-detail).

### Why are there only two safety status categories?

Based on the 2019 statewide bacteria water quality objectives and the epidemiological studies that inform them, there are two meaningful risk categories that can be used. While there are multiple metrics and thresholds used in calculating these statuses, these thresholds aim to simplify how we can determine if a distribution of rapidly varying bacteria concentrations poses a risk. Currently, we do not have the support to further divide the "Use caution" category into additional levels of risk. There is additional uncertainty that comes from the large variability in exposure from activity and exposure time that we cannot account for in this dashboard.

## Bacteria Objectives

The results displayed on this map are compared to the statewide bacteria water quality objectives, which are designed to protect recreational users from the effects of pathogens in California water bodies. This section provides more information about these objectives and how they are applied.

### What does "bacteria objectives" mean?

Bacteria objectives are standards set to protect public health by limiting the concentration of certain bacteria in recreational waters. These objectives are based on studies that find relationships between bacteria levels in water and the risk of illness among recreational users. The objectives specify levels of indicator bacteria, such as E. coli and enterococcus, that correspond to a certain amount of risk.

### What bacteria objectives are used in this dashboard?

This dashboard uses the [2019 statewide bacteria water quality objectives](https://www.waterboards.ca.gov/bacterialobjectives/) established by the State Water Resources Control Board. These objectives set specific thresholds for E. coli in freshwater and enterococcus in marine and estuarine waters.

### Are California's standards different from federal standards?

Yes, California has its own set of water quality standards that may differ from federal standards. The state often adopts more stringent regulations to protect public health and the environment. The state also may have more frequently updated standards as the understanding of measuring water quality and its impacts evolves.

### Why aren't fecal coliforms or total coliforms used in this dashboard?

Fecal coliforms and total coliforms are frequently used as indicators of water quality, but have been largely replaced by E. coli and enterococcus for assessing recreational water quality by the U.S. Environmental Protection Agency (EPA). Both E. coli and enterococcus have been shown to correlate better with the presence of pathogens that can cause illness in humans than metrics like fecal coliforms and total coliforms, according to 

### What do the safety thresholds mean for health?

The established thresholds we use in this dashboard have been shown to reflect conditions in which risk of gastrointestinal illness after water contact is measurably higher than the risk of gastrointestinal illness after no water contact. The language of risk is often challenging to communicate in public health settings—a site with a "Use caution" status cannot say with certainty that a particular swimmer's health will be impacted, but it is important for informing a percentage of swimmers that would contract an illness. We stress that a site with a "Use caution" status is not the same as a closure; the site may still be open, but it is more likely to become sick from water contact. Further, thresholds are only based on gastrointestinal illness, and do not account for other types of illnesses that may arise from water contact like skin rashes.

## Limitations

Water quality data is inherently limited by the frequency and locations of sampling. Not all water bodies are monitored, and conditions can change rapidly due to weather, pollution events, and other factors. While this dashboard provides valuable information, it should not be the sole basis for making decisions about water recreation.

1. **Incomplete coverage:** Not all recreational water bodies in California are monitored. Some areas may lack data entirely, while others may have infrequent sampling. Users should be aware that the absence of data does not imply safety. Additionally, statuses are estimates based on point data and may not represent conditions at other locations within the same water body.

2. **Data lag:** Data is collected and processed by hand, which can introduce delays. There may be a lag of several days between sample collection and data availability on the dashboard. Users should consider this lag when interpreting the data.

3. **Weather dependencies:** Precipitation and runoff can significantly impact water quality. Heavy rains can lead to increased levels of contaminants reaching bodies of water, while dry conditions may result in lower water levels. Users should consider recent weather conditions when interpreting water quality data. In particular, avoid water contact for at least 48 hours after significant rainfall events, as runoff can carry pollutants into recreational waters. Water quality can change rapidly, and this dashboard may not reflect the most current conditions.

4. **No connection to real-time closures:** This dashboard does not provide real-time information about water closures or advisories. Users should consult local health departments or agencies for the latest information on water safety and any active closures, which are typically posted physically at the waterbody or on the agency's website. These closures may be based on additional factors not represented in this dashboard, such as sewage spills or other pollution events.

5. **Human error:** Data collection and processing are subject to occasional human error, which can affect the accuracy of the information presented. Users should be aware of this potential limitation.

## Contact Information

Where can I get help or provide feedback?

Inquiries are welcome! Please reach out to swamp@waterboards.ca.gov with "Safe to Swim" in the subject line for technical support, data questions, or to provide feedback.

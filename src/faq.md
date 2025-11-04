---
title: Frequently Asked Questions (FAQs)
---

# Frequently Asked Questions (FAQs)

This page provides more information about the Safe to Swim Map by category. See the [How to Use](how-to-use) page for instructions on navigating the map.

---

## Water quality and health

Poor water quality can pose health risks to recreators engaging in water contact activities such as swimming, surfing, and wading. Exposure to contaminated water can lead to a variety of illnesses, including gastrointestinal infections, skin rashes, and respiratory issues. Vulnerable populations, including children, the elderly, and individuals with compromised immune systems, are at greater risk.

### What kind of activities are considered recreational?

Recreational activities refer to water contact recreation, as defined by the REC-1 beneficial use category. This includes swimming, surfing, wading, boating, fishing, and other water sports. These activities often involve direct contact with the water and may lead to accidental ingestion, which can increase the risk of exposure to harmful bacteria and pathogens.

### What are "indicator bacteria"?

On this dashboard, "indicator bacteria" refers to bacteria used to assess the quality of recreational waters. These bacteria are not necessarily harmful themselves, but their presence suggests that the water may be contaminated with potentially harmful pathogens. Such pathogens can cause gastrointestinal illness and other infections when people come in contact with or accidentally ingest contaminated water. Common fecal indicator bacteria include _E. coli_ and enterococcus, which are found in the intestines of warm-blooded animals. This map uses fecal indicator bacteria data to help evaluate water quality and potential health risks for recreational activities.

---

## Data sources and collection

### Where does this dashboard get its water quality data?

The data shown on this map are sourced from the [California Environmental Data Exchange Network](http://www.ceden.org/) (CEDEN) database, [BeachWatch](https://www.waterboards.ca.gov/water_issues/programs/beaches/search_beach_mon.html) database, and [Lower American River Recreational Water Quality Map](https://arcg.is/0ea0zq). While the data from the Lower American River is also included in CEDEN, there may be a delay before the most recent results appear in CEDEN.

### How is the data collected?

Most samples are collected by local public health agencies, environmental organizations, and other partners. Samples are typically obtained via grab sample at designated sites along beaches, rivers, and lakes. The samples are then analyzed in laboratories to measure levels of the indicator bacteria such as _E. coli_ and enterococcus.

There exist many methods of measuring bacteria concentrations, typically involving culturing bacteria from a water sample. Some local agencies have begun using rapid testing methods such as quantitative real-time PCR (qPCR) and droplet digital polymerase chain reaction (ddPCR). More information about the latest studies on methodology can be found on the [U.S. Environmental Protection Agency's (EPA) website](https://www.epa.gov/wqc/recreational-water-quality-criteria-and-methods).

### Why do I see different units (CFU vs MPN) for bacteria concentrations?

Methods for reporting microbial concentrations and detection limits can vary. For example, some laboratories may report concentrations in CFU/100mL (colony forming units per 100 milliliters), while others may use MPN/100mL (most probable number per 100 milliliters). CFU represents a direct count of bacterial colonies that grow on a solid agar medium, whereas MPN is a statistical estimate based on bacterial growth observed across multiple dilutions. Although the underlying methodologies differ, both units are widely accepted and considered functionally equivalent under California’s water quality standards.

### What is "ddPCR" and why do some samples have this method?

ddPCR, or droplet digital polymerase chain reaction, is a molecular testing method that enables highly precise quantification of DNA within a sample. In May 2022, San Diego County became the first Federal and State approved coastal county in the nation to begin using a ddPCR testing method that offers more rapid results. For enterococcus only, this map uses the ddPCR standard threshold value of 1,413 DNA copies of bacteria per 100 mililiters, the same threshold value documented on the [San Diego County Beach and Bay Program website](https://www.sandiegocounty.gov/content/sdc/deh/lwqd/beachandbay/). Results above this level may indicate a higher risk of illness.

We provide this information in the interest of transparency, but note that ddPCR is not yet widely used by other agencies in California, and the [Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/) do not yet include ddPCR thresholds. Safety statuses shown on this dashboard are only evaluated using culture-based methods (units of CFU or MPN).

### How often is data updated?

Data from CEDEN and BeachWatch are regularly prepared for the Safe to Swim Map and uploaded to the [California Open Data Portal](https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results) by the California State Water Resources Control Board, where it is then pulled into this dashboard. Updates typically occur on weekdays and may vary depending on staff availability.

### How is data processed for this dashboard?

Raw data is cleaned and validated to ensure accuracy and consistency. This involves removing duplicates, correcting errors, and standardizing formats. The processed data is then aggregated and analyzed for the dashboard. The Python code used for processing the data is publicly available as a Jupyter notebook file on GitHub: [SafeToSwim-v2-data.ipynb](https://github.com/mmtang/safe-to-swim-v2-data/blob/master/SafeToSwim-v2-data.ipynb). 

Some records are excluded from the final dataset during processing. These typically include duplicate or replicate results, records with missing or invalid result values, or any data that cannot be used to calculate a geometric mean. To promote transparency, a file with all the excluded records is available for download on the [California Open Data Portal](https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results). If you believe a data record was removed in error and should be included, please [contact](#contact) us so we can review it.

---

## Safety statuses

### What are safety statuses, and how should I interpret them?

"Low risk" indicates that the recent monitoring results meet the [Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/). "Use caution" indicates that the recent monitoring results are above these objectives, suggesting a higher potential health risk. Users should exercise caution when engaging in water contact recreation. 

### How are safety statuses evaluated?

Safety statuses are based on recent monitoring results and comparison to established thresholds. Based on the [Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/), a site has a "Use caution" status if *either* of the following is true:

1. More than 10% of single samples in the last 30 days exceed the single sample threshold.
2. The six-week rolling geometric mean exceeds the geometric mean threshold. The rolling window includes samples from the past six weeks, including the most recent sample.

A site is considered "Low risk" if *both* the single sample and six-week geometric mean are below their respective thresholds. If there are fewer than five samples in the past six weeks, the site will have a "Not enough data" status.

The thresholds used for determining safety statuses also depend on the type of specific indicator bacteria. _E. coli_ is used for freshwater sites, while enterococcus is used for marine and estuarine sites.

The six-week rolling geometric mean is calculated using enough samples to be statistically reliable, usually at least five samples collected over a six-week period. While the full dataset available on the [California Open Data Portal](https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results) includes geometric mean values based on fewer than five samples, this map only displays geometric mean values calculated from five or more samples.

### Why are there only two safety status categories?

Based on the [Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/) and the epidemiological studies that inform them, two meaningful risk categories are currently being used. While multiple metrics are involved in determining these statuses, the thresholds aim to simplify how we assess risk from fluctuating bacteria levels. At this time, we do not have the capacity to further divide the "Use caution" category into more detailed risk levels, though this may be considered in the future. It’s also important to note that this dashboard cannot account for the wide variability in individual exposure and activity duration, which adds uncertainty to the risk assessment.

---

## Bacteria objectives

The results displayed on this map are compared to the [Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/), which are designed to protect recreational users from the effects of pathogens in California water bodies. This section provides more information about these objectives and how they are applied.

### What does "bacteria objectives" mean?

Bacteria objectives are water quality standards that define acceptable concentrations of certain bacteria in recreational waters to protect public health. These objectives are based on studies that link bacteria levels in water to the risk of illness among recreational users who swim, wade, or engage in other water-contact activities. The objectives specify levels of indicator bacteria, such as _E. coli_ and enterococcus, which signal the presence of harmful pathogens. The specified levels correspond to an estimated level of health risk.

### What bacteria objectives are used in this dashboard?

This dashboard uses the [2019 Statewide Bacteria Water Quality Objectives](https://www.waterboards.ca.gov/bacterialobjectives/) established by the State Water Resources Control Board. These objectives set specific thresholds for _E. coli_ in freshwater and enterococcus in marine and estuarine waters to help assess potential health risks from recreational use.

### Are California's standards different from federal standards?

Yes, California has its own set of water quality standards that may differ from federal standards. The State often adopts more stringent regulations to protect public health and the environment. The State also may have more frequently updated standards as the understanding of measuring water quality and its impacts evolves.

### Why aren't fecal coliforms or total coliforms used in this dashboard?

Fecal coliforms and total coliforms are frequently used as indicators of water quality but have been largely replaced by _E. coli_ and enterococcus for assessing recreational water quality. According to the [U.S. EPA](https://www.epa.gov/wqc/recreational-water-quality-criteria-and-methods), both _E. coli_ and enterococcus have been shown to correlate better with the presence of pathogens that can cause illness in humans than metrics like fecal coliforms and total coliforms.

### What do the safety thresholds mean for health?

The thresholds used in this dashboard are based on conditions where the risk of gastrointestinal illness after water contact is measurably higher than the risk without water contact. A "Use caution" status does not guarantee that any individual will become ill, but it reflects a higher likelihood that some swimmers may experience illness. 

It’s important to note that a "Use caution" status is not the same as a closure; the site may remain open, but the potential for illness from water contact is elevated. Additionally, these thresholds are only based on gastrointestinal illness and do not account for other possible health effects, such as skin rashes or ear, eye, and respiratory infections.

---

## Limitations

Water quality data is inherently limited by the frequency and locations of sampling. Not all water bodies are monitored, and conditions can change rapidly due to weather, pollution events, and other factors. While this dashboard provides valuable information, it should not be the sole basis for making decisions about water recreation.

1. **Incomplete coverage:** Not all recreational water bodies in California are monitored. Some areas may lack data entirely, while others may have infrequent sampling. Users should be aware that the absence of data does not imply safety. Additionally, statuses are estimates based on point data and may not represent conditions at other locations within the same water body.

2. **Data lag:** Data collection and submission may involve some manual steps, which can introduce delays. As a result, there may be a lag of several days between when a sample is collected and when the data appears on the dashboard. Users should keep this in mind when interpreting the data.

3. **Weather:** Precipitation and runoff can significantly impact water quality. Heavy rains can lead to increased levels of contaminants reaching bodies of water, while dry conditions may result in lower water levels. Users should consider recent weather conditions when interpreting water quality data. In particular, avoid water contact for at least 72 hours after significant rainfall events, as runoff can carry pollutants into recreational waters. Water quality can change rapidly, and this dashboard may not reflect the most current conditions.

4. **No connection to real-time closures:** This dashboard does not provide real-time information about water closures or advisories. Users should consult local health departments or agencies for the latest information on water safety and any active closures, which are typically posted physically at the waterbody or on the agency's website. These closures may be based on additional factors not represented in this dashboard, such as sewage spills or other pollution events.

5. **Human error:** Data collection and processing are subject to occasional human error, which can affect the accuracy of the information presented. Users should be aware of this potential limitation.

---

## Contact

### Where can I get help or provide feedback?

Inquiries are welcome! Please reach out to swamp@waterboards.ca.gov with "Safe to Swim" in the subject line for technical support, data questions, or to provide feedback.

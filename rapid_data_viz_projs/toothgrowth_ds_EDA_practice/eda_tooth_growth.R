data("ToothGrowth")

View(ToothGrowth)

library(tidyverse)

filtered_tg<- filter(ToothGrowth, dose==0.5)

arrange(filtered_tg, len)

#nested fx
arrange(filter(ToothGrowth, dose==0.5),len)


#pipe "%>%" instead of nested fx
filtered_toothgrowth <- ToothGrowth %>% 
  filter(dose==0.5) %>% 
  arrange(len)

view(filtered_toothgrowth)

#avg tooth len for each of two supplements(VC,OJ)
filtered_toothgrowthAVG <- ToothGrowth %>% 
  filter(dose==0.5) %>%
  group_by(supp) %>% 
  summarize(mean_len = mean(len,na.rm = T),.group="drop")

View(filtered_toothgrowthAVG)

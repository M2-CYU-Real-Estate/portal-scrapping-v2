# Portal Scrapping v2

This is the base repository for all scrapper tasks that will be later used in the airflow pipeline.

Some rules for organization :

## Separate in folders

For each scrapper, we want to create a separate folder. The wanted structure should resemble to:

```
/portal-scrapping-v2 (root repository folder)
    /templates (containing various templates, see below)
    /[website-name-1]
        /[website-name-1]_[name_of_library]
        /[website-name-1]_[name_of_other_library]
```

For example:

```
/portal-scrapping-v2
    /templates
        /template-puppeteer
        /template-scrapy
    /seloger
        /seloger_scrapy
        /seloger_puppeteer
    /immo
        /immo_puppeteer
```

With this disposition, we can provide multiple implementations for each website.

## Organize each folder

Each scraper / implementation must have at least :
 - One README.md file (a bit of documentation)
 - One .gitignore file



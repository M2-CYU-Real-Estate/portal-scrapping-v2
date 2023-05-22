const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const commandLineArgs = require('command-line-args');

const DELAY_AFTER_LOAD_MS = 500;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function scrapeData(url) {

  const data = [];

  const browser = await puppeteer.launch({
    args: ['--no-sandbox'], // useful when using docker (allow using app as admin)
    headless: false,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  
  try{

    // Set a timeout for all subsequent actions performed on the page
    page.setDefaultTimeout(50000); // 50000 seconds
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await delay(DELAY_AFTER_LOAD_MS);

    // Scrape the data and push it into the `data` array
    const details = await page.$$eval('.node--view-mode-search',(elements)=>
      elements.map((e)=>({
        image: e.querySelector('.image-style-_280x720').src,
        link: e.querySelector('a').href
      })));
    let i=0;
    for (const detail of details) {
      await page.goto(detail.link,{ waitUntil: 'domcontentloaded' });
      await delay(DELAY_AFTER_LOAD_MS);

      const url = detail.link;
      
      const pageTitle = await page.title();
      let villeInfo = pageTitle.split(" - ");
      const ville = villeInfo[3];

      const typeBienSelector = 'div .field--name-field-type-property';
      const typeBienElement = await page.$(typeBienSelector);
      const typeBienText = typeBienElement ? await typeBienElement.evaluate(el => el.textContent.trim()) : 'none';
      const typeBienWords = typeBienText.split(' ');
      const typeBien = typeBienWords[typeBienWords.length - 1];

      const refSelector = 'div .property-header-type-address-type-ref';
      const refElement = await page.$(refSelector);
      const refText = refElement ? await refElement.evaluate(el => el.textContent.trim()) : 'none';
      let ref = refText.match(/REF:\s*(\d+)/)[1];
      ref = ville + "-" + ref;
      console.log(ref, url)


      const priceSelector = 'div .property-header-prices-fai';
      const priceElement = await page.$(priceSelector);
      let price = priceElement ? await priceElement.evaluate(el => el.textContent.trim()) : 'none';
      price = parseInt(price.replace(/[^\d]/g, ''));

      const surfaceSelector = 'div .field--name-extra-field-surface-icon';
      const surfaceElement = await page.$(surfaceSelector);
      let surface = surfaceElement ? await surfaceElement.evaluate(el => el.textContent.trim()) : 'none';
      surface = parseInt(surface);

      const piecesSelector = 'div .field--name-extra-field-rooms-icon';
      const piecesElement = await page.$(piecesSelector);
      let pieces = piecesElement ? await piecesElement.evaluate(el => el.textContent.trim()) : 'none';
      pieces = parseInt(pieces);

      const chambresSelector = 'div .field--name-extra-field-bedrooms-icon';
      const chambresElement = await page.$(chambresSelector);
      let chambres = chambresElement ? await chambresElement.evaluate(el => el.textContent.trim()) : 'none';
      chambres = parseInt(chambres);

      const descriptionSelector = 'div .field--name-field-description';
      const descriptionElement = await page.$(descriptionSelector);
      const description = descriptionElement ? await descriptionElement.evaluate(el =>
        el.textContent.replace(/[\n\t]/g, '').replace(/\s{2,}/g, ' '))  : 'none';

      const image = detail.image;

      // Wait for the characteristics section to load
      await page.waitForSelector('.group-characteristics-columns');

      // Extract characteristics
     
      const features = await page.evaluate(() => {
        const dict = {};
        const labels = document.querySelectorAll('.characteristics-columns-col');
        for (let i = 0; i < labels.length; i++) {
          if (i == 0) {
            const title = labels[i].querySelector('h3').textContent;
            const labelsList = labels[i].querySelectorAll('.field__label');
            const valuesList = labels[i].querySelectorAll('.field__item');
            const values = {};
            valuesList.forEach((value, index) => {
              const label = labelsList[index].textContent;
              values[label] = value.textContent;
            });
            dict[title] = values;
          } else {
            const childs = labels[i].children;
            const childArray = [].slice.call(childs);
            const res = childArray.map(a => [a.querySelector("h3").textContent, a]);
            for (const el of res){
              let title = el[0];
              let valuesList = el[1].querySelectorAll('div .field__item');
              const values = [];
              valuesList.forEach((value) => values.push(value.textContent));
              console.log("title:", title);
              console.log("content:", values);
              dict[title] = values;
              }
          }
        }
       
        return dict;
      });

      const energySelector = 'div .field.field--name-field-energy-class';
      const energyElement = await page.$(energySelector);
      const classEnergy = energyElement ? await energyElement.evaluate(el => el.textContent.trim()) : 'ND';

      const gazSelector = 'div .field.field--name-field-ghg-class';
      const gazElement = await page.$(gazSelector);
      const gazEmission = gazElement ? await gazElement.evaluate(el => el.textContent.trim()) : 'ND';
      
      features['classEnergy'] = classEnergy;
      features['gazEmission'] = gazEmission;
      
      
      
      const scrapedData = { title: pageTitle,url,ref,ville,typeBien, price, surface, pieces, chambres,features, image, description };

      data.push(scrapedData);
      console.log(`[ANNONCE ${i} SCRAPPED]`);
      i +=1;
     
    }

  }catch (e) {
    if (e instanceof puppeteer.errors.TimeoutError) {
      console.error('Timeout error:', e.message);
      await browser.close();
      return 1;
    }else {
      console.error('Other error:', e.message);
    }
  }

  await browser.close();
  return data;
}

async function run(url) {
  const data = await scrapeData(url);
  return data;
}

async function scrapeAllPages() {
  const allData = [];
  let i =1;
  while(true && i<=1){
    const url = `https://www.doorinsider.com/fr/annonces-immobilieres/vente/france?page=${i}`;
    const data = await run(url);
    if (data === undefined || data.length == 0) {
      console.log("[SCRAPPING HAS FINISHED]");
      break;
    }else if (data == 1){
      continue
    }else{
      allData.push(...data);
      console.log("[SCRAPPING FINISH FOR PAGE]", i)
      i++;
    }
  }
  
  

  return allData;
}

const parseArgs = () => {
  const optionDefitions = [
      {
          // Required
          name: "output",
          alias: "o",
          type: String 
      }
  ];
  const options = commandLineArgs(optionDefitions);

  // Check if valid
  if (!options.output) {
      throw new Error('"--output" argument required');
  }
  if (!fs.existsSync(options.output)) {
      throw new Error(`Output directory does not exist : ${options.output}`);
  }
  
  return options;
};


const main = async () => {

  const startTime = Date.now();

  const args = parseArgs();
  const outputPath = args.output;
  console.log("[SCRAPPING INITIATED...]")

  //TODO, call the specific method(s) for fetching data (iterable, array of jsons, whatever)
  scrapeAllPages()
      .then(data => {
          fs.writeFileSync(outputPath,
          // TODO, use outputPath to save to specific path
          JSON.stringify(data)
          )});

  const endTime = Date.now();
  console.log(`[TOTAL EXECUTION TIME : ${endTime - startTime}ms]`);
};


try {
  main();
} catch (err) {
  console.error("An error occured while scrapping data");
  console.error(err);
}

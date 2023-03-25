const puppeteer = require('puppeteer');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const { features } = require('process');

async function scrapeData(url) {
  const data = [];
  const browser = await puppeteer.launch({
      args: ['--no-sandbox'], // useful when using docker (allow using app as admin)
      headless: false,
      ignoreHTTPSErrors: true,
    });
  const page = await browser.newPage();
  // Set a timeout for all subsequent actions performed on the page
  page.setDefaultTimeout(30000); // 30 seconds

  try{
    await page.goto(url);

    // Wait for the button to appear
    // await page.waitForSelector('#onetrust-accept-btn-handler', { visible: true });

    // // Click on the button
    // await page.click('#onetrust-accept-btn-handler');

    // // Wait for the button to disappear
    // await page.waitForSelector('#onetrust-accept-btn-handler', { hidden: true });


    // Scrape the data and push it into the `data` array
    const details = await page.$$eval('article',(elements)=>
      elements.map((e)=>({
        link: e.querySelector('a').href
      })));

    let i=0;
    for (const detail of details) {
      await page.goto(detail.link);

      const url = detail.link;

      const pageTitle = await page.title();
      let titleParts = pageTitle.split(' | ');
      let titleInfo = titleParts[0].split(' • ');

      let typeBien = titleInfo[0].split(' ');
      typeBien =  typeBien[1];

      // Get the city name (assuming it's always the second element)
      const ville = titleInfo[1];

      // Get the price (assuming it's always the last element)
      let price = titleInfo[titleInfo.length - 1];
      price = parseInt(price.replace(/[^\d]/g, ''));

    
      const imageSelector = 'div a picture img';
      const imageElement = await page.$(imageSelector);
      const image = imageElement ? await imageElement.evaluate(el => el.src) : 'none';


      let pieces =0, surface=0,chambres = 0,toilletes = 0,parking = 0;
      const infoSelector = 'div.KeyInfoBlockStyle__InformationLogoContainer-sc-1o1h56e-10.eYArfF';
      const infoElement = await page.$(infoSelector);
      const infoPost = infoElement ? await infoElement.evaluate(el => el.textContent) : 'none';
      const infoLists = infoPost.split(' ');

      if (infoLists.length == 9){
          pieces = await parseInt(infoLists[3].replace(/[^\d]/g, ''));
          surface = parseInt(infoLists[7].replace(/[^\d]/g, ''));

          const priceRange = await page.$('div.KeyInfoBlockStyle__Price-sc-1o1h56e-5.fpNLMn h2');
          const priceRangeEl = priceRange ? await priceRange.evaluate(el => el.textContent) : 'none';
          const priceList = priceRangeEl.split(' ');
          price = priceList[3];
          price = parseInt(price.replace(/[^\d]/g, ''));;
        
      }else if (infoLists.length == 6){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[4].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        toilletes = parseInt(infoLists[2].replace(/[^\d]/g, ''));
        parking = parseInt(infoLists[3].replace(/[^\d]/g, ''));
        
      }else if (infoLists.length == 5){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[3].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        toilletes = 0;
        parking = parseInt(infoLists[2].replace(/[^\d]/g, ''));
        
      }else if (infoLists.length == 4){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[2].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        toilletes = 0;
        parking = 0;
        
      }else{
        continue;
      }
      if (price == NaN || price ==0) {
        continue;
      }
      
      const refSelector = 'h1.KeyInfoBlockStyle__PdpTitle-sc-1o1h56e-2.ilPGib span';
      const refElement = await page.$(refSelector);
      let ref = refElement ? await refElement.evaluate(el => el.textContent) : 'none';
      ref = ref.split(" ");
      ref = ref[1];

      const descriptionSelector = 'div.collapsed p';
      const descriptionElement = await page.$(descriptionSelector);
      const description = descriptionElement ? await descriptionElement.evaluate(el => el.textContent.replace(/[\n\t]/g, '').replace(/\s{2,}/g, ' '))  : 'none';

      // Get the feature block
      const rowFeatures = await page.$$('.row-feature');
      const featuresArr = [];
      // for (const rowFeature of rowFeatures) {
      //   if (rowFeature) {
      //     const features = await rowFeature.$$eval('.feature-bloc-content-specification-content', elems =>
      //       elems.map(elem => {
      //         const titleElem = elem.querySelector('.feature-bloc-content-specification-content-name');
      //         const title = titleElem ? titleElem.textContent.trim() : '';
      //         const valueElem = elem.querySelector('.feature-bloc-content-specification-content-response div');
      //         const value = valueElem ? valueElem.textContent.trim() : '';
      //         return { title, value };
      //       })
      //     );
      //     featuresArr.push(...features);
      //   } else {
      //     console.log('row-feature element not found');
      //   }
      // }
      // const featureObj = featuresArr.reduce((obj, item) => {
      //   obj[item.title] = item.value;
      //   return obj;
      // }, {});
      
      const scrapedData = {
        title: titleParts[0],
        url,
        ref,
        typeBien,
        ville,
        price,
        surface,
        pieces,
        chambres,
        toilletes,
        parking,
        // features: featureObj,
        image,
        description
      };
      
      // Push the scrapedData object to the data array
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
  while(true && i <=21){
    
    const url = `https://www.immoregion.fr/vente?page=${i}`;
    const data = await run(url);
    
    if (data === undefined || data.length == 0) {
      console.log("[SCRAPPING HAS FINISHED]");
      break;
    }else if (data == 1){
     continue;
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
};


try {
  main();
} catch (err) {
  console.error("An error occured while scrapping data");
  console.error(err);
}

const puppeteer = require('puppeteer');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const path = require('path');

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

     await page.goto(url, { waitUntil: 'domcontentloaded' });
     await delay(DELAY_AFTER_LOAD_MS);

    // Scrape the data and push it into the `data` array
    const details = await page.$$eval('article',(elements)=>
      elements.map((e)=>({
        link: e.querySelector('a').href
      })));

    let i=0;
    for (const detail of details) {
      await page.goto(detail.link,{ waitUntil: 'domcontentloaded' });
      await delay(DELAY_AFTER_LOAD_MS);
      
      let listData = await extractData(detail, page)

       // We will initialise some variable
       let pieces =0, surface=0,chambres = 0,toilletes = 0,parking = 0;

       const infoSelector = 'div.KeyInfoBlockStyle__InformationLogoContainer-sc-1o1h56e-10.eYArfF';
       const infoElement = await page.$(infoSelector);
       const infoPost = infoElement ? await infoElement.evaluate(el => el.textContent) : 'none';
       const infoLists = infoPost.split(' ');
 
      // si les biens sont groupés
      if (infoLists.length == 9){
          const subDetails = await page.$$eval('div.residence-informations-content',(elements)=>
            elements.map((e)=>({
              link: e.querySelector('a').href
            })));
  
          for (const subDetail of subDetails) {
  
            await page.goto(subDetail.link);
  
            let listDetail = await extractData(subDetail, page);

            const infoSelector = 'div.KeyInfoBlockStyle__InformationLogoContainer-sc-1o1h56e-10.eYArfF';
            const infoElement = await page.$(infoSelector);
            const infoPost = infoElement ? await infoElement.evaluate(el => el.textContent) : 'none';
            const infoLists = infoPost.split(' ');

            if (infoLists.length == 6){
              pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
              surface = parseInt(infoLists[4].replace(/[^\d]/g, ''));
              chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
              toilletes = parseInt(infoLists[2].replace(/[^\d]/g, ''));
              parking = parseInt(infoLists[3].replace(/[^\d]/g, ''));
              
            }else if (infoLists.length == 5){
              pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
              surface = parseInt(infoLists[3].replace(/[^\d]/g, ''));
              chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
              parking = parseInt(infoLists[2].replace(/[^\d]/g, ''));
              
            }else if (infoLists.length == 4){
              pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
              surface = parseInt(infoLists[2].replace(/[^\d]/g, ''));
              chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
              parking = 0;
      
            }else {
              console.log("url ", detail.link);
            }
            listDetail.push(pieces)
            listDetail.push(surface)
            listDetail.push(chambres)
            listDetail.push(parking);
            console.log(listDetail[2], listDetail[1])
            
            // pus the final data
            const dataDict = {
              "title": listDetail[0],
              "url":listDetail[1],
              "ref":listDetail[2],
              "typeBien":listDetail[3],
              "ville":listDetail[4],
              "codePostale":listDetail[5],
              "price":listDetail[6],
              "image":listDetail[7],
              "description":listDetail[8],
              "features":listDetail[9],
              "pieces":listDetail[10],
              "surface":listDetail[11],
              "chambres":listDetail[12],
              "parking":listDetail[13],
            };
            
            // Push the scrapedData object to the data array
            data.push(dataDict);
            console.log(`[ANNONCE ${i} SCRAPPED]`);
            i +=1;
        }

      // If it is not grouped 
      }else if (infoLists.length == 6){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[4].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        parking = parseInt(infoLists[3].replace(/[^\d]/g, ''));
        
      }else if (infoLists.length == 5){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[3].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        parking = parseInt(infoLists[2].replace(/[^\d]/g, ''));
        
      }else if (infoLists.length == 4){
        pieces = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        surface = parseInt(infoLists[2].replace(/[^\d]/g, ''));
        chambres = parseInt(infoLists[1].replace(/[^\d]/g, ''));
        parking = 0;

      }else {
        console.log("url ", detail.link);
        pieces = 0;
        surface = parseInt(infoLists[0].replace(/[^\d]/g, ''));
        chambres = 0;
        parking = 0;
      }

      listData.push(pieces)
      listData.push(surface)
      listData.push(chambres)
      listData.push(parking)
     
      const dataDict = {
        "title": listData[0],
        "url":listData[1],
        "ref":listData[2],
        "typeBien":listData[3],
        "ville":listData[4],
        "codePostale":listData[5],
        "price":listData[6],
        "image":listData[7],
        "description":listData[8],
        "features":listData[9],
        "pieces":listData[10],
        "surface":listData[11],
        "chambres":listData[12],
        "parking":listData[13],
      };
      console.log(listData[2], listData[1])
      
      // Push the scrapedData object to the data array
      data.push(dataDict);
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

async function extractData(detail, page){

  const url = detail.link;
  const pageTitle = await page.title();
  let titleParts = pageTitle.split(' | ');
  let titleInfo = titleParts[0].split(' • ');

  // get typeBien
  let typeBien = titleInfo[0].split(' ');
  typeBien =  typeBien[1];
  
  const  postalCode='', ville = titleInfo[1];

  // Get the price
  const priceSelector = 'h2';
  const priceElement = await page.$(priceSelector);
  let price = priceElement ? await priceElement.evaluate(el => el.textContent) : 'none';
  price = parseInt(price.replace(/[^\d]/g, ''));

  // get referencence
  const refSelector = 'h1 span';
  const refElement = await page.$(refSelector);
  let ref = refElement ? await refElement.evaluate(el => el.textContent) : 'none';
  ref = ref.split(" ");
  ref = ref[1];
  ref = ville + "-" + ref;

  // Get the image
  const imageSelector = 'source';
  const imageElement = await page.$(imageSelector);
  const image = imageElement ? await imageElement.evaluate(el => el.srcset) : 'none';

  // Get the description 
  const descriptionSelector = 'div.collapsed p';
  const descriptionElement = await page.$(descriptionSelector);
  const description = descriptionElement ? await descriptionElement.evaluate(el => el.textContent.replace(/[\n\t]/g, '').replace(/\s{2,}/g, ' '))  : 'none';

  // Get the feature block
  const rowFeatures = await page.$$('.row-feature');
  const featuresArr = [];
  for (const rowFeature of rowFeatures) {
    if (rowFeature) {
      const features = await rowFeature.$$eval('.feature-bloc-content-specification-content', elems =>
        elems.map(elem => {
          const titleElem = elem.querySelector('.feature-bloc-content-specification-content-name');
          const title = titleElem ? titleElem.textContent.trim() : '';
          const valueElem = elem.querySelector('.feature-bloc-content-specification-content-response div');
          const value = valueElem ? valueElem.textContent.trim() : '';
          return { title, value };
        })
      );
      featuresArr.push(...features);
    } else {
      console.log('row-feature element not found');
    }
  }
  const featureObj = featuresArr.reduce((obj, item) => {
    obj[item.title] = item.value;
    return obj;
  }, {});

  return  [pageTitle, url,ref, typeBien, ville,postalCode, price, image, description, featureObj]

}

async function run(url) {
  const data = await scrapeData(url);
  return data;
}

async function scrapeAllPages() {
  const allData = [];
  let i =1;
  while(true && i <=1){
    
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

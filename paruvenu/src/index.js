const puppeteer = require('puppeteer');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const { title } = require('process');

async function scrapeData(url) {
  const data = [];
  const browser = await puppeteer.launch({
      args: ['--no-sandbox'], // useful when using docker (allow using app as admin)
      headless: false,
      ignoreHTTPSErrors: true,
    });
  const page = await browser.newPage();

  // Set a timeout for all subsequent actions performed on the page
  page.setDefaultTimeout(50000); // 30 seconds

  try{
    await page.goto(url);

    // Wait for the button to appear
    await page.waitForSelector('div.container.buttons button:nth-child(2)');

    // Click on the button
    await page.click('div.container.buttons button:nth-child(2)');

    // Wait for the button to disappear
    await page.waitForSelector('div.container.buttons button:nth-child(2)', { hidden: true });

    //Scrape the data and push it into the `data` array

    const hrefs = await page.$$eval('.flex.sm\\:block.gap-4 a', links => links.map(link => link.href));

    let i=1;
    for (const href of hrefs) {
      await page.goto(href);

      const pageTitle = await page.title();
      // Remove all special characters
      const cleanInput = pageTitle.replace(/[^\w\s]/gi, '');
      // Split the input by whitespace
      const parts = cleanInput.split(/\s+/);

      // Extract the desired values
      let ville ='';
      if (parts[3] == 'La' || parts[3] =='Le'){
        ville = parts[3]+ ' '+ parts[4];
      }else{
        ville = parts[3];
      }
      const typeBien = parts[2];
      const surface = parseInt(parts[5]);
      const price = parseFloat(parts[7]+parts[8]);
      const ref = parseFloat(parts[9]);

      const pieceSelector = 'li.nbp';
      const pieceElement = await page.$(pieceSelector);
      const pieces = pieceElement ? await pieceElement.evaluate(el => el.textContent.trim()) : 'none';

      const features = await page.evaluate(() => {
        const infos = document.querySelectorAll('ul.crit-alignbloc');
        const result = {};
        for (let i = 0; i < infos.length; i++) {
          const spans = infos[i].querySelectorAll('li span');
          spans.forEach((span) => {
            const [key, value] = span.textContent.trim().split(':');
            if (key && value) {
              result[key.trim()] = value.trim();
            }else{
              result[key.trim()] =null;
            }
          });
        }
        return result;
      });
      
      const imageSelector = 'img.im11_pic_main';
      const imageElement = await page.$(imageSelector);
      const image = imageElement ? await imageElement.evaluate(el => el.src) : 'none';

      const energySelector = 'div .DPE_consEnerNote';
      const energyElement = await page.$(energySelector);
      const classEnergy = energyElement ? await energyElement.evaluate(el => el.textContent.trim()) : 'none';

      const gazSelector = 'div .DPE_effSerreNote';
      const gazElement = await page.$(gazSelector);
      const gazEmission = gazElement ? await gazElement.evaluate(el => el.textContent.trim()) : 'none';

      features['classEnergy'] = classEnergy;
      features['gazEmission'] = gazEmission;

      const url = href;
      const parking = 0;
      const chambres = 0;
      const toilletes = 0;

      const descriptionSelector = 'div#txtAnnonceTrunc';
      const descriptionElement = await page.$(descriptionSelector);
      const description = descriptionElement ? await descriptionElement.evaluate(el => el.textContent.replace(/[\n\t]/g, '').replace(/\s{2,}/g, ' '))  : 'none';
      
      const hasCuisine = description.includes('cuisine');
      const cuisine = hasCuisine ? 'Oui' : 'Non';

      const scrapedData = { title: pageTitle,url,ref,typeBien,ville, price, surface, pieces, chambres,toilletes,parking,cuisine, features, description, image };
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
  while(true && i <=1){
    
    const url = `https://www.paruvendu.fr/immobilier/vente/maison/?p=${i}`;
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

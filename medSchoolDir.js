const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs-extra');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await fs.writeFile('medSchoolDir.csv','Country,City,Medical School Name,School Type,Year Instruction Started,Operational Status,School Website,Main Address,Phone Number,Fax Number,Email,wdoms\n')

    //get all countries
    const allCountriesPromise = await axios.get('https://search.wdoms.org/Home/GetCountriesList?sUnmember=&_=1550868639760');
    const allCountries = allCountriesPromise.data;

    for (let i = 0; i < 1; i++) {
      // const { countryCode, countryName } = allCountries[i];
      const countryCode = '099';
      const countryName = "United States of America";
      await page.goto('https://search.wdoms.org/');

      //main search page
      await page.click('input[name="un_box"]');
      await page.waitForSelector(`option[value="${countryCode}"]`);
      await page.click('#countrylist');
      await page.select('#countrylist', countryCode);
      await page.click('.span2 input[type="button"]');
      await page.waitForSelector('tbody > tr > td[style]');

      //grab all faimerSchoolIds
      let faimerSchoolIds = [];
      let cityNames = [];
      const totalPages = await page.$eval('#hdntotalcount', ele => Number(ele.value));
      for (let j = 0; j < totalPages; j++) {
        if (j !== 0) {
          await page.click('#Next');
          await page.waitForSelector('tbody > tr > td[style]');
        }
        const schoolId = await page.$$eval('tbody > tr > td[style]', arr => {
          return arr.map(ele => ele.innerText);
        })
        const cityNameArr = await page.$$eval('tbody > tr td:last-child', arr => {
          return arr.map(ele => ele.innerText);
        })
        faimerSchoolIds = [...faimerSchoolIds, ...schoolId];
        cityNames = [...cityNames, ...cityNameArr];
      }

      //grab all info
      for (let k = 0; k < faimerSchoolIds.length; k++) {
        const cityName = cityNames[k];
        const endPoint = faimerSchoolIds[k].split('');
        while (endPoint.length <= 7) endPoint.unshift('0');
        const wdomsURL = `https://search.wdoms.org/home/SchoolDetail/F${endPoint.join('')}`;
        await page.goto(wdomsURL, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#General .span8');
        const schoolName = await page.$eval('.buffer h3', ele => ele.innerText);

        const allRows = await page.$$eval('.row-fluid', arr => {
          return arr.map((ele, i) => {
            if (i === 0) return [null, null];
            let key = ele.querySelector('.span4.pagination-right');
            if (key) key = key.innerText.trim().replace(':', '');
            let value = ele.querySelector('.span8');
            if (value) value = value.innerText.trim().replace(/\s\s+/g, ', ');
            const schoolWebsite = ele.querySelector('.span8 a');
            if (schoolWebsite) return [key, schoolWebsite.href];
            return [key, value];
          })
        })

        const schema = {};
        for (let row of allRows) {
          let key = row[0];
          let value = row[1];
          if (!key) continue;
          if (!value || value.length === 0) value = 'null';
          schema[key] = value
        }
        // console.log(`${countryName},${cityName},${schoolName},${schema['School Type']},${schema['Year Instruction Started']},${schema['Operational Status']},${schema['School Website(s)']},${schema['Main Address']},"${schema['Phone Number(s)']}","${schema['Fax Number(s)']}",${schema['Email']},${wdomsURL}\n`);
        await fs.appendFile('medSchoolDir.csv', `${countryName},${cityName},"${schoolName}",${schema['School Type']},${schema['Year Instruction Started']},${schema['Operational Status']},${schema['School Website(s)']},"${schema['Main Address']}",${schema['Phone Number(s)']},${schema['Fax Number(s)']},${schema['Email']},${wdomsURL}\n`)
      }
    }

    console.log('done');
    await browser.close();
  } catch (error) {
    console.log('---Our Error---\n', error);
  }
})();

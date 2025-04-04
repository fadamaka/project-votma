const puppeteer = require("puppeteer-core");
const config = require("./config.json");

(async () => {
  const chromeDebugResp = await fetch("http://127.0.0.1:9222/json/version");
  const jsonBody = await chromeDebugResp.json();
  // Launch the browser and open a new blank page
  const browser = await puppeteer.connect({
    browserWSEndpoint: jsonBody.webSocketDebuggerUrl,
  });
  const page = await browser.newPage();

  // Navigate the page to a URL.
  await page.goto("https://www.messenger.com/t/" + config.convoId);

  // Set screen size.
  await page.setViewport({ width: 900, height: 1024 });

  const tripleDot = await page.waitForSelector(
    '[aria-label="Conversation information"]'
  );
  if (tripleDot) {
    tripleDot.click();
  }

  const span = await page.waitForSelector('::-p-xpath(//span[text()="Media"])');

  if (span) {
    await span.click();
  } else {
    throw "Something went wrong!";
  }
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const scrollElementToChild = async (containerSelector, childSelector) => {
    const container = await page.waitForSelector(containerSelector, {
      timeout: 30000,
      visible: true,
    });
    if (!container) {
      console.log("Container not found.");
      return null;
    }

    let child = null;
    while (!child) {
      try {
        // Check if the child is visible
        child = await page.waitForSelector(childSelector, {
          timeout: 1000,
          visible: true,
        });
        if (child) {
          // Ensure it's within the container
          const isChildOfContainer = await page.evaluate(
            (cont, ch) => cont.contains(ch),
            container,
            child
          );
          if (!isChildOfContainer) {
            child = null;
            throw new Error("Child not in container");
          }
        }
      } catch (e) {
        // Scroll the container down by 1000px
        await page.evaluate((el) => {
          el.scrollTop += 1000;
        }, container);
        await delay(200); // Small delay for rendering
      }
    }
    return child;
  };

  const debugXPathasync = async (containerSelector) => {
    const elementHandler = await page.waitForSelector(containerSelector, {
      timeout: 30000,
      visible: true,
    });
    console.log(await page.evaluate((el) => el.outerHTML, elementHandler));
  };

  // await debugXPathasync(
  //   '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div)'
  // );

  // Scroll the .scrollable div until the span is visible

  // const span3 = await scrollElementToChild(
  //   '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div)',
  //   '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div/div/div/div/div/div/div/div[4])'
  // );
  const scrollUntil = async (monthIndex) => {
    await scrollElementToChild(
      '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div)',
      '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div/div/div/div/div/div/div/div[' +
        monthIndex +
        "])"
    );
  };
  // const mainDiv = await page.$(
  //   '::-p-xpath(//span[text()="March"]/parent::div/parent::div/div[2]/div/div/div/div/img)'
  // );
  // console.log(await page.evaluate((el) => el.outerHTML, mainDiv));
  // const imgSrc = await page.evaluate((el) => el.getAttribute("src"), mainDiv);
  // console.log(imgSrc);

  // const countMonthsAfter = await page.$$(
  //   '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div/div/div/div/div/div/div/div)'
  // );

  // console.log("months after: ", countMonthsAfter.length);
  let pictureCount = 0;

  const saveChildren = async (monthIndex) => {
    const children = await page.$$eval(
      '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div/div/div/div/div/div/div/div[' +
        monthIndex +
        "]/div[2]/div/div/div/div/img)",
      (els) => els.map((el) => el.getAttribute("src"))
    );
    const mName = await page.$eval(
      '::-p-xpath(//span[text()="Media, files and links"]/../../../../../div[3]/div/div/div/div/div/div/div/div/div/div/div/div[' +
        monthIndex +
        "]/div[1]/span)",
      (el) => {
        let name = el.textContent.toLowerCase().replaceAll(" ", "_");

        return name.includes("_") ? name : name + "_2025";
      }
    );

    require("fs").mkdirSync("archive/" + mName, { recursive: true });
    let counter = 1;
    for (let index = children.length - 1; index >= 0; index--) {
      const src = children[index];
      require("fs").writeFileSync(
        "archive/" + mName + "/" + counter + ".jpg",
        Buffer.from(await (await fetch(src)).arrayBuffer())
      );
      counter++;
    }
    console.log(mName + ":", children.length);
    pictureCount += children.length;
  };

  for (let i = 1; i < 25; i++) {
    await scrollUntil(i + 1);
    await saveChildren(i);
  }
  console.log("total count:", pictureCount);

  //await page.close();
  await browser.disconnect();
})();

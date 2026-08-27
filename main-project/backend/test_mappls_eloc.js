require("dotenv").config();

async function testElocLookup() {
  const staticKey = process.env.MAPPLS_STATIC_KEY;
  const eloc = "ARV605";

  const endpoints = [
    `https://search.mappls.com/search/address/eloc/${eloc}?access_token=${staticKey}`,
    `https://search.mappls.com/search/address/geocode?eloc=${eloc}&access_token=${staticKey}`,
    `https://apis.mappls.com/advancedmaps/v1/${staticKey}/eloc/${eloc}`,
    `https://explore.mappls.com/api/places/eloc/${eloc}?access_token=${staticKey}`
  ];

  for (let i = 0; i < endpoints.length; i++) {
    console.log(`\nTesting eLoc Endpoint ${i + 1}: ${endpoints[i].split("?")[0]}`);
    try {
      const res = await fetch(endpoints[i], {
        headers: { "User-Agent": "SIH-Flood-Evacuation-System/1.0" }
      });
      console.log(`HTTP Status: ${res.status}`);
      const text = await res.text();
      console.log("Response Body:", text.substring(0, 400));
    } catch (err) {
      console.error(`Error ${i + 1}:`, err.message);
    }
  }
}

testElocLookup();

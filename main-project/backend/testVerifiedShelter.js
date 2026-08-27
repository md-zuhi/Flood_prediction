const {
    getVerifiedShelters,
} = require("./services/verifiedShelterService");

async function test() {
    const result = await getVerifiedShelters({
        latitude: 11.3533,
        longitude: 76.7959,

        district: "Nilgiris",
        state: "Tamil Nadu",

        radiusKm: 25,

        potentialFacilities: [
            {
                id: "coonoor-lawley-hospital",
                name: "Coonoor Government Lawley Hospital",
                type: "GOVERNMENT_HOSPITAL",

                latitude: 11.356,
                longitude: 76.797,

                source: "LOCAL_FACILITY_DIRECTORY",
            },
        ],
    });

    console.log(
        JSON.stringify(result, null, 2)
    );
}

test().catch(console.error);
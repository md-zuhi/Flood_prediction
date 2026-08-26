// Deep HDF5 dataset inspector — reads actual array values
import h5wasm from 'h5wasm/node';
import path from 'path';
import os from 'os';

const filePath = path.join(os.tmpdir(), 'smap_inspect.h5');

async function inspect() {
  await h5wasm.ready;
  let f;
  try {
    f = new h5wasm.File(filePath, 'r');

    // The actual group in this file
    const GROUP = 'Soil_Moisture_Retrieval_Data';
    const datasets = ['latitude', 'longitude', 'soil_moisture', 'retrieval_qual_flag'];

    for (const ds of datasets) {
      const fullPath = `${GROUP}/${ds}`;
      try {
        const d = f.get(fullPath);
        console.log(`\n--- ${fullPath} ---`);
        console.log('  type:', d?.type);
        console.log('  shape:', JSON.stringify(d?.shape));
        console.log('  dtype:', d?.dtype);
        // Try to read value
        try {
          const val = d?.value;
          if (val) {
            const arr = Array.from(val).slice(0, 10);
            console.log('  first 10 values:', arr);
            console.log('  total elements:', val.length);
          }
        } catch (e) {
          console.log('  value error:', e.message);
        }
        // Read attrs
        try {
          const attrs = d?.attrs;
          if (attrs) {
            const keys = Object.keys(attrs);
            console.log('  attrs:', keys);
            if (attrs._FillValue) console.log('  _FillValue:', attrs._FillValue.value);
          }
        } catch (e) {
          console.log('  attrs error:', e.message);
        }
      } catch (e) {
        console.log(`  ERROR accessing ${fullPath}:`, e.message);
      }
    }

    // Also check tb_time_utc for timestamps
    try {
      const timeDs = f.get(`${GROUP}/tb_time_utc`);
      console.log('\n--- tb_time_utc ---');
      console.log('  type:', timeDs?.type);
      console.log('  shape:', JSON.stringify(timeDs?.shape));
      const tv = timeDs?.value;
      if (tv) console.log('  first 3:', Array.from(tv).slice(0, 3));
    } catch (e) {
      console.log('tb_time_utc error:', e.message);
    }

  } finally {
    if (f) f.close();
  }
}

inspect().catch(console.error);

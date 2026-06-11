let map1, map2, map3, map4, map5, map6;
const TULA_COORDS = [54.193122, 37.617348];

function initMap(containerId, center, zoom) {
  const map = L.map(containerId).setView(center, zoom);
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; OSM & CartoDB",
    },
  ).addTo(map);
  return map;
}

window.addEventListener("load", () => {
  map1 = initMap("geocodeMap", TULA_COORDS, 14);
  map2 = initMap("tileMap", TULA_COORDS, 13);
  map3 = initMap("geohashMap", TULA_COORDS, 13);
  map4 = initMap("routeMap", TULA_COORDS, 14);
  map5 = initMap("isoMap", TULA_COORDS, 13);
  map6 = initMap("deliveryMap", TULA_COORDS, 14);
});

// ========== 1. Геокодинг (Nominatim) ==========
document.getElementById("geocodeBtn").onclick = async () => {
  const addr = document.getElementById("addressInput").value;
  if (!addr) {
    alert("Введите адрес");
    return;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "GeoTula/1.0" },
    });
    const data = await resp.json();
    if (data.length === 0) throw new Error("Объект не найден");
    const lat = data[0].lat,
      lon = data[0].lon;
    document.getElementById("geocodeResult").innerHTML =
      `Широта: ${lat}<br>Долгота: ${lon}<br><br>Полный адрес:<br>${data[0].display_name}`;
    map1.setView([lat, lon], 16);
    L.marker([lat, lon]).addTo(map1).bindPopup(addr).openPopup();
  } catch (e) {
    document.getElementById("geocodeResult").innerHTML = `Ошибка: ${e.message}`;
  }
};

document.getElementById("reverseBtn").onclick = async () => {
  const lat = parseFloat(document.getElementById("latInput").value);
  const lng = parseFloat(document.getElementById("lngInput").value);
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "GeoTula/1.0" },
    });
    const data = await resp.json();
    document.getElementById("reverseResult").innerHTML =
      data.display_name || "Адрес не определен";
    map1.setView([lat, lng], 16);
    L.marker([lat, lng]).addTo(map1).bindPopup(data.display_name).openPopup();
  } catch (e) {
    document.getElementById("reverseResult").innerHTML = `Ошибка: ${e.message}`;
  }
};

// ========== 2. Тайлинг ==========
const zoomSlider = document.getElementById("zoomSlider");
const zoomVal = document.getElementById("zoomValue");
zoomSlider.oninput = () => {
  zoomVal.innerText = zoomSlider.value;
  map2.setZoom(parseInt(zoomSlider.value));
};

document.getElementById("showTileInfo").onclick = () => {
  const z = parseInt(zoomSlider.value);
  const lat = TULA_COORDS[0],
    lon = TULA_COORDS[1];
  function lonToTile(lon, z) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  }
  function latToTile(lat, z) {
    return Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        Math.pow(2, z),
    );
  }
  const x = lonToTile(lon, z);
  const y = latToTile(lat, z);
  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  document.getElementById("tileInfo").innerHTML = `
            Масштаб (Z) = ${z}<br>
            Индекс X = ${x}<br>
            Индекс Y = ${y}<br><br>
            Ссылка на тайл:<br>
            <a href="${tileUrl}" target="_blank" class="result-link">${tileUrl}</a><br>
            <img src="${tileUrl}" class="tile-preview-img">
        `;
};

// ========== 3. Геохеш ==========
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function encodeGeohash(lat, lon, precision) {
  let latRange = [-90, 90],
    lonRange = [-180, 180];
  let bits = 0,
    ch = 0,
    hash = "";
  let isEven = true;
  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonRange[0] = mid;
      } else {
        ch = ch << 1;
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latRange[0] = mid;
      } else {
        ch = ch << 1;
        latRange[1] = mid;
      }
    }
    bits++;
    if (bits === 5) {
      hash += BASE32[ch];
      bits = 0;
      ch = 0;
    }
    isEven = !isEven;
  }
  return hash;
}

function decodeGeohash(hash) {
  let latRange = [-90, 90],
    lonRange = [-180, 180];
  let isEven = true;
  for (let i = 0; i < hash.length; i++) {
    const idx = BASE32.indexOf(hash[i]);
    if (idx === -1) break;
    let bits = 4;
    while (bits >= 0) {
      const bit = (idx >> bits) & 1;
      if (isEven) {
        const mid = (lonRange[0] + lonRange[1]) / 2;
        if (bit === 1) lonRange[0] = mid;
        else lonRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (bit === 1) latRange[0] = mid;
        else latRange[1] = mid;
      }
      isEven = !isEven;
      bits--;
    }
  }
  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lon: (lonRange[0] + lonRange[1]) / 2,
  };
}

function getGeohashBounds(hash) {
  let latRange = [-90, 90],
    lonRange = [-180, 180];
  let isEven = true;
  for (let i = 0; i < hash.length; i++) {
    const idx = BASE32.indexOf(hash[i]);
    for (let bits = 4; bits >= 0; bits--) {
      const bit = (idx >> bits) & 1;
      if (isEven) {
        const mid = (lonRange[0] + lonRange[1]) / 2;
        if (bit === 1) lonRange[0] = mid;
        else lonRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (bit === 1) latRange[0] = mid;
        else latRange[1] = mid;
      }
      isEven = !isEven;
    }
  }
  return [
    [latRange[0], lonRange[0]],
    [latRange[1], lonRange[1]],
  ];
}

document.getElementById("calcGeohash").onclick = () => {
  const lat = parseFloat(document.getElementById("ghLat").value);
  const lng = parseFloat(document.getElementById("ghLng").value);
  const prec = parseInt(document.getElementById("ghPrecision").value);
  const geohash = encodeGeohash(lat, lng, prec);
  const centerDec = decodeGeohash(geohash);
  document.getElementById("geohashResult").innerHTML =
    `Geohash строка: ${geohash}<br>Центр полигона:<br>${centerDec.lat.toFixed(6)}, ${centerDec.lon.toFixed(6)}`;
  map3.eachLayer((l) => {
    if (l instanceof L.Marker || l instanceof L.Rectangle) map3.removeLayer(l);
  });
  map3.setView([centerDec.lat, centerDec.lon], 13);
  L.marker([centerDec.lat, centerDec.lon])
    .addTo(map3)
    .bindPopup(geohash)
    .openPopup();
  const bounds = getGeohashBounds(geohash);
  if (bounds)
    L.rectangle(bounds, {
      color: "#af62d2",
      weight: 2,
      fillOpacity: 0.15,
    }).addTo(map3);
};

// ========== 4. Маршруты (OSRM) ==========
async function geocodeToCoord(addr) {
  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
    { headers: { "User-Agent": "GeoTula" } },
  );
  const data = await resp.json();
  if (!data.length) throw new Error("Адрес не найден");
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

document.getElementById("routeBtn").onclick = async () => {
  const start = document.getElementById("startAddr").value;
  const end = document.getElementById("endAddr").value;
  try {
    const [lon1, lat1] = await geocodeToCoord(start);
    const [lon2, lat2] = await geocodeToCoord(end);
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const resp = await fetch(osrmUrl);
    const json = await resp.json();
    if (json.code !== "Ok") throw new Error("Маршрут не построен");
    const route = json.routes[0];
    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationMin = (route.duration / 60).toFixed(0);
    document.getElementById("routeResult").innerHTML =
      `Дистанция: ${distanceKm} км<br>Время в пути: ${durationMin} мин`;
    map4.eachLayer((l) => {
      if (l instanceof L.Polyline || l instanceof L.Marker) map4.removeLayer(l);
    });
    L.geoJSON(route.geometry, { color: "#ffb300", weight: 5 }).addTo(map4);
    map4.fitBounds(L.geoJSON(route.geometry).getBounds());
    L.marker([lat1, lon1]).addTo(map4).bindPopup(`Старт: ${start}`);
    L.marker([lat2, lon2]).addTo(map4).bindPopup(`Финиш: ${end}`);
  } catch (e) {
    document.getElementById("routeResult").innerHTML = `Ошибка: ${e.message}`;
  }
};

// ========== 5. Изохроны (2ГИС) ==========
const TWOGIS_API_KEY = "98c5508d-3e0c-480c-9ace-9037d996cd2e";

async function geocodeToCoord2gis(address) {
  const url = `https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(address)}&key=${TWOGIS_API_KEY}&fields=items.point`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.result?.items?.length) throw new Error("Адрес не найден");
  return data.result.items[0].point;
}

function wktToGeoJSON(wkt) {
  const multiPolygonMatch = wkt.match(/MULTIPOLYGON\(\(\((.*?)\)\)\)/);
  if (!multiPolygonMatch) return { type: "FeatureCollection", features: [] };
  const rings = multiPolygonMatch[1].split(/\),\(/);
  const polygons = rings.map((ring) => {
    const points = ring.split(",").map((pair) => {
      const [lng, lat] = pair.trim().split(" ").map(Number);
      return [lng, lat];
    });
    return [points];
  });
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: polygons },
      },
    ],
  };
}

document.getElementById("isoBtn").onclick = async () => {
  const address = document.getElementById("isoPoint").value;
  const mode = document.getElementById("isoMode").value;
  const minutes = parseInt(document.getElementById("isoTime").value);
  const resultDiv = document.getElementById("isoResult");
  resultDiv.innerHTML = "Запрос к 2ГИС API...";

  try {
    const { lat, lon } = await geocodeToCoord2gis(address);
    const response = await fetch(
      `https://routing.api.2gis.com/isochrone/2.0.0?key=${TWOGIS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat, lon },
          durations: [minutes * 60],
          transport: mode,
          reverse: false,
        }),
      },
    );
    const data = await response.json();
    if (data.status !== "OK" || !data.isochrones?.length)
      throw new Error("Ошибка построения");

    const geojson = wktToGeoJSON(data.isochrones[0].geometry);
    map5.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Marker)
        map5.removeLayer(layer);
    });
    L.geoJSON(geojson, {
      style: {
        color: "#8b45ac",
        weight: 2,
        fillOpacity: 0.3,
        fillColor: "#af62d2",
      },
    }).addTo(map5);
    L.marker([lat, lon]).addTo(map5).bindPopup(address).openPopup();

    const rusMode =
      mode === "walking" ? "Пешком" : mode === "driving" ? "Авто" : "Велосипед";
    resultDiv.innerHTML = `Зона построена!<br>Время: ${minutes} мин<br>Транспорт: ${rusMode}`;
  } catch (error) {
    resultDiv.innerHTML = `Ошибка: ${error.message}`;
  }
};

// ========== 6. Индивидуальное Задание: Зона доставки курьера ==========
document.getElementById("calcDeliveryBtn").onclick = async () => {
  const address = document.getElementById("restaurantAddress").value.trim();
  const minutes = parseInt(document.getElementById("deliveryTime").value);
  const statusDiv = document.getElementById("deliveryStatus");
  const geoJsonOutput = document.getElementById("geoJsonOutput");

  if (!address) {
    statusDiv.innerHTML =
      '<span style="color: #ef4444;">Ошибка: введите адрес ресторана</span>';
    return;
  }

  statusDiv.innerHTML = "Геокодирование адреса ресторана...";
  geoJsonOutput.value = "";

  try {

    const { lat, lon } = await geocodeToCoord2gis(address);
    statusDiv.innerHTML = `Ресторан найден: [${lat}, ${lon}]. Запрос изохроны пешего курьера...`;

    const response = await fetch(
      `https://routing.api.2gis.com/isochrone/2.0.0?key=${TWOGIS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat, lon },
          durations: [minutes * 60],
          transport: "walking",
          reverse: false,
        }),
      },
    );

    const data = await response.json();
    if (data.status !== "OK" || !data.isochrones?.length) {
      throw new Error(
        data.message || "Не удалось построить зону для этого адреса",
      );
    }

    const geojson = wktToGeoJSON(data.isochrones[0].geometry);

    geoJsonOutput.value = JSON.stringify(geojson, null, 4);

    map6.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON || layer instanceof L.Marker)
        map6.removeLayer(layer);
    });

    const deliveryLayer = L.geoJSON(geojson, {
      style: {
        color: "#8b45ac",
        weight: 2,
        fillOpacity: 0.25,
        fillColor: "#af62d2",
      },
    }).addTo(map6);

    L.marker([lat, lon])
      .addTo(map6)
      .bindPopup(`<b>Ресторан:</b><br>${address}`)
      .openPopup();

    map6.fitBounds(deliveryLayer.getBounds());
    statusDiv.innerHTML = `Успешно! Построена зона доставки пешего курьера на <b>${minutes} мин.</b>`;
  } catch (error) {
    statusDiv.innerHTML = `<span style="color: #ef4444;"><b>Ошибка:</b> ${error.message}</span>`;
    geoJsonOutput.value = "";
  }
};

// Переключение вкладок (Sidebar)
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    [map1, map2, map3, map4, map5, map6].forEach(
      (m) => m && setTimeout(() => m.invalidateSize(), 100),
    );
  });
});

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mindee = require("mindee");
const cors = require("cors");  // <-- AÑADIDO


const PORT = process.env.PORT || 3000;
const app = express();
// AÑADIDO: Habilitar CORS para que el frontend pueda conectar
app.use(cors());

// Variables de entorno
const MINDEE_API_KEY = process.env.MINDEE_API_KEY;
const MINDEE_MODEL_ID = process.env.MINDEE_MODEL_ID;

if (!MINDEE_API_KEY || !MINDEE_MODEL_ID) {
  console.error("Faltan MINDEE_API_KEY o MINDEE_MODEL_ID");
  process.exit(1);
}

// Crear carpeta uploads
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

// Cliente Mindee (se crea una sola vez)
const mindeeClient = new mindee.ClientV2({ apiKey: MINDEE_API_KEY });

// Ruta principal: subir + procesar con Mindee
app.post("/images", upload.single("Imagen"), async (req, res) => {
  let rutaCompleta = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se recibió imagen" });
    }

    // Añadir extensión correcta
    let ext = ".jpg";
    if (req.file.mimetype === "image/png") ext = ".png";
    else if (req.file.mimetype === "image/jpeg") ext = ".jpg";
    else if (req.file.mimetype === "image/gif") ext = ".gif";

    const nuevoNombre = req.file.filename + ext;
    rutaCompleta = path.join(uploadsDir, nuevoNombre);
    fs.renameSync(req.file.path, rutaCompleta);  // Sync para evitar problemas

    // Procesar con Mindee
    //const inputSource = mindeeClient.docFromPath(rutaCompleta);
    const inputSource = mindee.document(mindee.product.custom.CustomV1, rutaCompleta);

    const inferenceParams = {
      modelId: MINDEE_MODEL_ID,
      rawText: true,
      polygon: true,
      confidence: true,
    };

    const apiResponse = await mindeeClient.enqueueAndGetInference(inputSource, inferenceParams);
    console.log(apiResponse.inference.toString());
    // Borrar archivo temporal
    fs.unlinkSync(rutaCompleta);

    // Enviar resultado al frontend
    res.json({
      success: true,
      message: "Imagen procesada con éxito",
      data: {
        summary: apiResponse.inference.toString(),
        fields: apiResponse.inference.result.fields,  // Aquí tienes todos los campos extraídos
        // Puedes extraer campos específicos aquí, ej: total: fields.get("total")?.value
      }
    });

  } catch (error) {
    console.error("Error:", error);
    if (rutaCompleta && fs.existsSync(rutaCompleta)) {
      fs.unlinkSync(rutaCompleta);
    }
    res.status(500).json({
      success: false,
      message: "Error procesando la imagen",
      error: error.message
    });
  }
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor Mindee funcionando correctamente");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
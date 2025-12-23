const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");  // <-- AÑADIDO
const OpenAI = require("openai");
const cloudinary = require("cloudinary").v2;
require('dotenv').config();


const PORT = process.env.PORT || 3000;
const app = express();

// AÑADIDO: Habilitar CORS para que el frontend pueda conectar
app.use(cors());

//Configuración cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Variables de entorno
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;
const OPEN_ROUTER_MODEL_ID = process.env.OPEN_ROUTER_MODEL_ID;

//Nuevo cliente
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPEN_ROUTER_API_KEY,
});

// Crear carpeta uploads
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

//Función Llamar al modelo correspondiente:

async function call_model(prompt,imageUrl) {
  const completion = await openai.chat.completions.create({
    model: OPEN_ROUTER_MODEL_ID,
    messages: [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": prompt,

          },
          {
            "type": "image_url",
            "image_url": {
              "url": imageUrl
            }
          }
        ]
      }
    ]
  });

  console.log(completion.choices[0].message);
}

// Ruta principal: subir + procesar con Mindee
app.post("/images", upload.single("Imagen"), async (req, res) => {
  let rutaCompleta = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se recibió imagen" });
    }

    // Obtener el texto enviado desde Flutter
    const textoUsuario = req.body.texto || "";
    console.log("Texto recibido:", textoUsuario);
    const prompt = "Eres un asistente de moda experto. Te voy a enviar una foto de un outfit." + "La ocasión:" + textoUsuario + "Tu tarea es:" +
      "1. Analizar el outfit en la imagen basandote en el estilo, combinación de colores y adecuación a la ocasión.." + "2. Darle una puntuación del 1 al 10" +
      "3. Proporcionar 3 recomendaciones claras para mejorar el outfit" +
      "4. Responder en formato JSON con tres campos: \"score\" (número del 1 al 10), \"Opinion personal\"(Ademas da alguna recomendación en tono personal) y \"recomendaciones\" (lista de 3 frases)." +
      "Recuerda ser conciso y directo. No agregues explicaciones adicionales fuera del JSON.";

    // Añadir extensión correcta para la foto
    let ext = ".jpg";
    if (req.file.mimetype === "image/png") ext = ".png";
    else if (req.file.mimetype === "image/jpeg") ext = ".jpg";
    else if (req.file.mimetype === "image/gif") ext = ".gif";

    const nuevoNombre = req.file.filename + ext;
    rutaCompleta = path.join(uploadsDir, nuevoNombre);
    fs.renameSync(req.file.path, rutaCompleta);  // Sync para evitar problemas

    //Subir imagen y conseguir URL
    const result = await cloudinary.uploader.upload(rutaCompleta);
    const imageUrl = result.secure_url; // esta es la URL pública

    // Borrar archivo temporal
    fs.unlinkSync(rutaCompleta);

    //Enviar outfit al modelo
    await call_model(prompt,imageUrl);
    // Enviar resultado al frontend
    res.json({
      success: true,
      message: "Imagen y texto Recibidos con éxito",
      data: {
        texto: textoUsuario,
        filename: nuevoNombre

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
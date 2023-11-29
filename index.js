const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const qrcode = require('qrcode-terminal');

const { Client, LocalAuth} = require('whatsapp-web.js');
const ALLOWED_NUMBERS = ['51938963486@c.us', '51900772778@c.us', '51991369684@c.us'];
const apiUrl = 'http://localhost:8000/payments/upload_payment_file'; // Reemplaza 'puerto' y 'ruta' con los valores específicos de tu API
const apiKey = 'keyprueba'; // Reemplaza 'tu_api_key' con tu clave de API

const SESSION_FILE_PATH = './.wwebjs_auth';
let sessionData;
let client;

const withSession = () => {
    client = new Client({
        authStrategy: new LocalAuth({ clientId: "hola" }),
        puppeteer: { 
            headless: true, 
            args: ['--no-sandbox']
        }
    });

    client.on('authenticated',session => {
        sessionData = session;  
    });

    client.on('ready', () => {
        console.log("El Cliente esta listo...\n");
        listenMessage();
    });

    client.on('auth_failure', () => {
        console.log('Error de autenticacion vuelve a generar el QRCODE')
    })

    client.initialize();
}


const withOutSession = () => {
    console.log("No hay session guardada");
    client = new Client({
        authStrategy: new LocalAuth({ clientId: "hola" }), 
        puppeteer: { 
            headless: true, 
            args: ['--no-sandbox'] 
        }
    });
    client.on('qr', (qr) => {
        qrcode.generate(qr,{ small : true });
    });

    client.on('authenticated',session => {
        sessionData = session;  
    });

    client.initialize();
}


const listenMessage = () => {
    client.on('message', async msg => {
        const {from, to, body} = msg;
        if (ALLOWED_NUMBERS.includes(from) ){
            console.log('Mensaje recibido', msg);
            if(msg.hasMedia){
                console.log('Mensaje con imagen recibido');
                const media = await msg.downloadMedia();
                const buffer = Buffer.from(media.data, 'base64');
    
                // Guardar la imagen en el sistema de archivos
                const imagePath = `${from}.jpg`;
                fs.writeFileSync(imagePath, buffer);
    
                // Enviar la imagen a la API y procesar la respuesta 
                try {
                    // Crea un objeto FormData
                    const formData = new FormData();
    
                    // Agrega la imagen al FormData usando un stream
                    const imageStream = fs.createReadStream(imagePath);
                    formData.append('file', imageStream, { filename: 'imagen.jpg' });
    
                    const response = await axios.post(apiUrl, formData,{
                        headers: {
                            ...formData.getHeaders(),
                            'API-LAMBDA-KEY': apiKey,
                          },
                    });
    
                    // Procesar la respuesta de la API
                    console.log('Respuesta de la API:', response.data);
    
                    // Responder al remitente de WhatsApp con la información recibida de la API
                    client.sendMessage(from, `Respuesta de la API: ${JSON.stringify(response.data)}`);
                } catch (error) {
                    console.error('Error al enviar la imagen a la API:', error.response.data);
                    client.sendMessage(from, 'Ocurrió un error al procesar la imagen en la API.');
                }
            }
            else{
                client.sendMessage(from, 'Gracias por enviarme un mensaje');
            }
        }
    }
    );
}


// Verificar si existe un archivo con credenciales de sesión
(fs.existsSync(SESSION_FILE_PATH)) ? withSession() : withOutSession();
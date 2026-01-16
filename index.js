const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- KONFIGURACJA ---
const BOT_TOKEN = 'MTQ2MDcwNzU3OTA3NTM2Njk5Ng.GK58W9.lay1EqGq1ypwo9jEzaomYY9dhsuKCiR1AltDHA'; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});

app.use(express.urlencoded({ extended: true }));

// --- STRONA WWW (Z KŁÓDKĄ NA RENDERZE) ---

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    if (!userId) return res.status(400).send('Błąd: Brak tokenu autoryzacji.');

    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <title>Discord | Autoryzacja</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background-color: #2f3136; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="background-color: #36393f; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); text-align: center; max-width: 400px; width: 90%;">
                <img src="https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico" width="50" style="margin-bottom: 20px;">
                <h2 style="margin-bottom: 10px;">Autoryzacja Konta</h2>
                <p style="color: #b9bbbe; font-size: 15px; margin-bottom: 25px;">Kliknij przycisk poniżej, aby potwierdzić członkostwo i uzyskać dostęp do kanałów.</p>
                <form action="/complete" method="POST">
                    <input type="hidden" name="userId" value="${userId}">
                    <button type="submit" style="background-color: #5865f2; color: white; border: none; padding: 14px 20px; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%;">
                        Zakończ weryfikację
                    </button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        // Sprawdzanie VPN (dyskretne)
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=1`);
        const result = response.data[cleanIP];

        if (result && result.proxy === 'yes') {
            return res.status(403).send('<h1 style="color: #ff4747; text-align: center; font-family: sans-serif; margin-top: 50px;">Błąd: Połączenie odrzucone (VPN/Proxy).</h1>');
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);

        if (member) {
            await member.roles.add(ROLE_ID);
            res.send('<h1 style="color: #43b581; text-align: center; font-family: sans-serif; margin-top: 50px;">Sukces! Możesz wrócić na Discorda.</h1>');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Błąd serwera. Upewnij się, że bot ma uprawnienia i właściwą hierarchię ról.');
    }
});

client.login(BOT_TOKEN);
app.listen(PORT, () => console.log(`Serwer weryfikacji działa na porcie ${PORT}`));

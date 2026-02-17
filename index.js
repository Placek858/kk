app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ICARUS | Secure Verification</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
                
                body { 
                    margin: 0; padding: 0; font-family: 'Inter', sans-serif; 
                    background: #0a0a0a; color: #ffffff;
                    display: flex; justify-content: center; align-items: center; height: 100vh;
                }

                .container {
                    width: 100%; max-width: 400px; padding: 40px;
                    background: #111111; border: 1px solid #222;
                    border-radius: 12px; text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }

                .logo {
                    font-weight: 600; letter-spacing: -1px; font-size: 24px;
                    margin-bottom: 8px; color: #fff;
                }

                .status-tag {
                    display: inline-block; padding: 4px 12px; background: rgba(88, 101, 242, 0.1);
                    color: #5865f2; font-size: 11px; font-weight: 600; border-radius: 20px;
                    margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;
                }

                .description { color: #888; font-size: 14px; line-height: 1.6; margin-bottom: 32px; }

                .btn {
                    background: #ffffff; color: #000000; border: none;
                    padding: 14px 28px; font-weight: 600; font-size: 15px;
                    border-radius: 8px; width: 100%; cursor: pointer;
                    transition: all 0.2s ease;
                }

                .btn:hover { background: #e0e0e0; transform: translateY(-1px); }
                .btn:disabled { background: #333; color: #666; cursor: not-allowed; }

                /* Czysty loader */
                .loader {
                    display: none; width: 24px; height: 24px; border: 2px solid #333;
                    border-top: 2px solid #fff; border-radius: 50%;
                    margin: 0 auto 20px; animation: spin 0.8s linear infinite;
                }

                #console { color: #555; font-size: 12px; margin-top: 20px; height: 14px; }

                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">ICARUS</div>
                <div class="status-tag">Security Node v5.0</div>
                <p class="description">W celu zapewnienia bezpieczeństwa społeczności, wymagana jest krótka autoryzacja Twojego profilu.</p>
                
                <div class="loader" id="loader"></div>
                <div id="status-area">
                    <button class="btn" id="startBtn">Zweryfikuj profil</button>
                </div>
                <div id="console"></div>
            </div>

            <script>
                const userId = "${userId}";
                const btn = document.getElementById('startBtn');
                const loader = document.getElementById('loader');
                const con = document.getElementById('console');

                async function check() {
                    const r = await fetch('/status?userId=' + userId);
                    const s = await r.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        location.reload();
                    }
                }

                btn.onclick = async () => {
                    btn.style.display = 'none';
                    loader.style.display = 'block';
                    con.innerText = "Trwa analiza bezpieczeństwa...";

                    const fp = btoa(screen.width+"x"+screen.height);

                    const res = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, fp })
                    });
                    const d = await res.json();

                    if(d.action === 'success') {
                        document.querySelector('.container').innerHTML = '<div style="font-size:40px">✅</div><h2>Zweryfikowano</h2><p style="color:#888">Dostęp został przyznany. Możesz wrócić do aplikacji.</p>';
                    } else if(d.action === 'wait') {
                        con.innerText = "Wymagana dodatkowa weryfikacja przez administratora.";
                        setInterval(check, 3000);
                    } else {
                        con.style.color = "#ff4444";
                        con.innerText = "Błąd: " + d.msg;
                        btn.style.display = 'block';
                        loader.style.display = 'none';
                    }
                };
            </script>
        </body>
        </html>
    `);
});

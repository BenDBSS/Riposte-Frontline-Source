import asyncio, sys, json
from playwright.async_api import async_playwright
PKG="/home/claude/fps/package/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":960,"height":540})
        await pg.add_init_script("try{localStorage.setItem('dc_settings', JSON.stringify({quality:'low'}))}catch(e){}")
        logs=[]
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        async def route(r):
            u=r.request.url
            if "three@0.147.0/" in u: await r.fulfill(path=PKG+u.split("three@0.147.0/")[1], content_type="application/javascript")
            elif "@pmndrs/assets@1.7.0/" in u: await r.fulfill(path="/tmp/pa/package/"+u.split("@pmndrs/assets@1.7.0/")[1], content_type="application/javascript", headers={"Access-Control-Allow-Origin": "*"})
            elif "fonts.g" in u: await r.abort()
            else: await r.continue_()
        await pg.route("**/*", route)
        await pg.goto("file:///home/claude/fps/index.html")
        await pg.wait_for_function("typeof MATCH!=='undefined' && MATCH.state==='menu'", timeout=180000)
        await pg.evaluate("typeof mapEnsure === 'function' ? mapEnsure(Settings.map) : null")  # carte construite au lancement d'une partie
        for code in sys.argv[1:]:
            r = await pg.evaluate(code)
            print(">>", json.dumps(r)[:3000] if r is not None else None)
        print("\n".join(logs[:30]))
        await b.close()
asyncio.run(main())

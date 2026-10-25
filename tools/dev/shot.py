import asyncio, sys, json
from playwright.async_api import async_playwright
PKG="/home/claude/fps/package/"
SHOTS=json.load(open(sys.argv[1])); Q=sys.argv[2] if len(sys.argv)>2 else 'medium'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":960,"height":540})
        await pg.add_init_script("try{localStorage.setItem('dc_settings', JSON.stringify({quality:'%s'}))}catch(e){}"%Q)
        logs=[]
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ('error','warning') else None)
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
        for js, fn, wait in SHOTS:
            r = await pg.evaluate(js)
            if r is not None: print(fn, json.dumps(r)[:500])
            await pg.wait_for_timeout(wait)
            await pg.screenshot(path=fn, timeout=180000)
        print("\n".join(logs[:20]))
        await b.close()
asyncio.run(main())

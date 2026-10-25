"""Construit assets/tex/ : textures CC0 (Poly Haven, ambientCG) redimensionnées en WebP, un dossier par surface
(map.webp, normal.webp, rough.webp) et la liste des crédits (credits.json). build.py en fait un fichier par surface à
côté de la page (dist/tex/), que le jeu charge au lancement de la première carte qui s'en sert."""
import io, json, os
from PIL import Image, ImageOps, ImageStat

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
PH = str(ROOT / 'assets_src' / 'polyhaven')
AC = str(ROOT / 'assets_src' / 'ambientcg')
# clé du jeu : (source, dossier, fichiers couleur/normale/rugosité, canal de rugosité, options)
SETS = {
  'plaster': ('Poly Haven', 'white_plaster_rough_01', f'{PH}/white_plaster_rough_01/diff.jpg', f'{PH}/white_plaster_rough_01/nor.jpg', f'{PH}/white_plaster_rough_01/arm.jpg', 'G', {'level': 205, 'desat': 0.55}),
  'asphalt': ('ambientCG', 'Asphalt021', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_Color.jpg', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_NormalGL.jpg', f'{AC}/Asphalt021_2K-JPG/Asphalt021_2K-JPG_Roughness.jpg', 'L', {'level': 92, 'desat': 0.3}),
  'pavers': ('ambientCG', 'Concrete012', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_Color.jpg', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_NormalGL.jpg', f'{AC}/Concrete012_2K-JPG/Concrete012_2K-JPG_Roughness.jpg', 'L', {'level': 175, 'desat': 0.4}),
  'cobble': ('Poly Haven', 'cobblestone_floor_001', f'{PH}/cobblestone_floor_001/diff.jpg', f'{PH}/cobblestone_floor_001/nor.jpg', f'{PH}/cobblestone_floor_001/arm.jpg', 'G', {'level': 150, 'desat': 0.35}),
  'brick': ('ambientCG', 'Bricks066', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_Color.jpg', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_NormalGL.jpg', f'{AC}/Bricks066_2K-JPG/Bricks066_2K-JPG_Roughness.jpg', 'L', {'level': 190, 'desat': 0.8}),
  'stone': ('Poly Haven', 'rustic_stone_wall_02', f'{PH}/rustic_stone_wall_02/diff.jpg', f'{PH}/rustic_stone_wall_02/nor.jpg', f'{PH}/rustic_stone_wall_02/arm.jpg', 'G', {'level': 150, 'desat': 0.25}),
  'plaster2': ('Poly Haven', 'clay_plaster', f'{PH}/clay_plaster/diff.jpg', f'{PH}/clay_plaster/nor.jpg', f'{PH}/clay_plaster/arm.jpg', 'G', {'level': 195, 'desat': 0.45}),
  'shutter': ('Poly Haven', 'wood_shutter', f'{PH}/wood_shutter/diff.jpg', f'{PH}/wood_shutter/nor.jpg', f'{PH}/wood_shutter/arm.jpg', 'G', {'level': 175, 'desat': 0.85}),
  'rooftiles': ('Poly Haven', 'clay_roof_tiles_03', f'{PH}/clay_roof_tiles_03/diff.jpg', f'{PH}/clay_roof_tiles_03/nor.jpg', f'{PH}/clay_roof_tiles_03/arm.jpg', 'G', {'level': 0, 'desat': 0.0}),
  'wood': ('Poly Haven', 'weathered_brown_planks', f'{PH}/weathered_brown_planks/diff.jpg', f'{PH}/weathered_brown_planks/nor.jpg', f'{PH}/weathered_brown_planks/arm.jpg', 'G', {'level': 0, 'desat': 0.35, 'rgb': (176, 148, 120)}), # (octobre 2026 : moins orangé, même luminosité ; il paraissait peint)
  # Stratus : la roche stratifiée des falaises et les couches du sol (elles remplacent les surfaces procédurales de même nom pour la carte
  # qui les demande ; Hortus garde les siennes). Téléchargées de dl.polyhaven.org (jpg 2K : diff, nor_gl, arm)
  'strata': ('Poly Haven', 'cliff_side', f'{PH}/cliff_side/diff.jpg', f'{PH}/cliff_side/nor.jpg', f'{PH}/cliff_side/arm.jpg', 'G', {'level': 150, 'desat': 0.5}),
  'lawn': ('Poly Haven', 'aerial_grass_rock', f'{PH}/aerial_grass_rock/diff.jpg', f'{PH}/aerial_grass_rock/nor.jpg', f'{PH}/aerial_grass_rock/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'nsize': 512, 'mul': (0.72, 1.0, 0.5)}),
  'dirt': ('Poly Haven', 'forest_ground_04', f'{PH}/forest_ground_04/diff.jpg', f'{PH}/forest_ground_04/nor.jpg', f'{PH}/forest_ground_04/arm.jpg', 'G', {'level': 125, 'desat': 0.1, 'nsize': 512}),
  'flagstone': ('Poly Haven', 'stone_pathway', f'{PH}/stone_pathway/diff.jpg', f'{PH}/stone_pathway/nor.jpg', f'{PH}/stone_pathway/arm.jpg', 'G', {'level': 150, 'desat': 0.25}),
  'humus': ('Poly Haven', 'forest_leaves_02', f'{PH}/forest_leaves_02/diff.jpg', f'{PH}/forest_leaves_02/nor.jpg', f'{PH}/forest_leaves_02/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'nsize': 512}),
  # Meltem : murets de pierre sèche et sol de base (les dallages aux joints blanchis et la chaux restent procéduraux) ; Tephra : cendre
  # (le basalte vacuolaire, la mousse en coussins et la lave restent procéduraux : les photos essayées étaient moins lisibles)
  'drystone': ('Poly Haven', 'stone_wall', f'{PH}/stone_wall/diff.jpg', f'{PH}/stone_wall/nor.jpg', f'{PH}/stone_wall/arm.jpg', 'G', {'level': 0, 'desat': 0.0}),
  # Simoun : le reg, sol de graviers et de sable damé des camps et des pistes (la terre de forêt, feuilles mortes comprises, n'avait rien d'un désert)
  'reg': ('Poly Haven', 'sandy_gravel_02', f'{PH}/sandy_gravel_02/diff.jpg', f'{PH}/sandy_gravel_02/nor.jpg', f'{PH}/sandy_gravel_02/arm.jpg', 'G', {'level': 112, 'desat': 0.1, 'nsize': 512}),
  'sand': ('Poly Haven', 'dense_sand', f'{PH}/dense_sand/diff.jpg', f'{PH}/dense_sand/nor.jpg', f'{PH}/dense_sand/arm.jpg', 'G', {'level': 168, 'desat': 0.0, 'nsize': 512}),
  'ash': ('Poly Haven', 'gravel_stones', f'{PH}/gravel_stones/diff.jpg', f'{PH}/gravel_stones/nor.jpg', f'{PH}/gravel_stones/arm.jpg', 'G', {'level': 48, 'desat': 0.3, 'nsize': 512}),
  # Khamsin, Val-Blanc, Hortus : pierre de taille ; Khamsin, Val-Blanc, Kervénec, Hortus : béton ; Val-Blanc : neige, neige tassée,
  # roche, planches, ardoise, écorce des conifères (Kervénec partage roche, planches et ardoise) ; Hortus : écorce, gravier des allées (la rocaille de la
  # serre reste procédurale : sa photo était plus fade ; la tôle ondulée aussi : taches en camouflage sur les toits)
  'ashlar': ('Poly Haven', 'seaworn_sandstone_brick', f'{PH}/seaworn_sandstone_brick/diff.jpg', f'{PH}/seaworn_sandstone_brick/nor.jpg', f'{PH}/seaworn_sandstone_brick/arm.jpg', 'G', {'level': 158, 'desat': 0.2}),
  'concrete': ('Poly Haven', 'concrete_wall_009', f'{PH}/concrete_wall_009/diff.jpg', f'{PH}/concrete_wall_009/nor.jpg', f'{PH}/concrete_wall_009/arm.jpg', 'G', {'level': 158, 'desat': 0.6}),
  'snow': ('Poly Haven', 'snow_02', f'{PH}/snow_02/diff.jpg', f'{PH}/snow_02/nor.jpg', f'{PH}/snow_02/arm.jpg', 'G', {'level': 221, 'desat': 0.6, 'nsize': 512, 'mul': (0.95, 0.98, 1.06)}),
  'snowpack': ('Poly Haven', 'snow_01', f'{PH}/snow_01/diff.jpg', f'{PH}/snow_01/nor.jpg', f'{PH}/snow_01/arm.jpg', 'G', {'level': 202, 'desat': 0.5, 'nsize': 512, 'mul': (0.95, 0.98, 1.06)}),
  'rock': ('Poly Haven', 'rock_face', f'{PH}/rock_face/diff.jpg', f'{PH}/rock_face/nor.jpg', f'{PH}/rock_face/arm.jpg', 'G', {'level': 117, 'desat': 0.9}),
  'boards': ('Poly Haven', 'wooden_planks', f'{PH}/wooden_planks/diff.jpg', f'{PH}/wooden_planks/nor.jpg', f'{PH}/wooden_planks/arm.jpg', 'G', {'level': 80, 'desat': 0.1}),
  'slate': ('Poly Haven', 'roof_slates_03', f'{PH}/roof_slates_03/diff.jpg', f'{PH}/roof_slates_03/nor.jpg', f'{PH}/roof_slates_03/arm.jpg', 'G', {'level': 68, 'desat': 0.4, 'mul': (0.92, 0.98, 1.12)}),
  'barkw': ('Poly Haven', 'pine_bark', f'{PH}/pine_bark/diff.jpg', f'{PH}/pine_bark/nor.jpg', f'{PH}/pine_bark/arm.jpg', 'G', {'level': 35, 'desat': 0.2}),
  'bark': ('Poly Haven', 'bark_willow_02', f'{PH}/bark_willow_02/diff.jpg', f'{PH}/bark_willow_02/nor.jpg', f'{PH}/bark_willow_02/arm.jpg', 'G', {'level': 99, 'desat': 0.1}),
  'pathgravel': ('Poly Haven', 'gravel_floor_02', f'{PH}/gravel_floor_02/diff.jpg', f'{PH}/gravel_floor_02/nor.jpg', f'{PH}/gravel_floor_02/arm.jpg', 'G', {'level': 171, 'desat': 0.0, 'nsize': 512, 'mul': (1.06, 1.0, 0.86)}),
  # Simoun : le pisé du ksar (terre damée), les briques de terre crue de la kasbah, les galets et la vase craquelée du lit de l'oued
  'pise': ('Poly Haven', 'excavated_soil_wall', f'{PH}/excavated_soil_wall/diff.jpg', f'{PH}/excavated_soil_wall/nor.jpg', f'{PH}/excavated_soil_wall/arm.jpg', 'G', {'level': 172, 'desat': 0.5, 'nsize': 512}),
  'adobe': ('Poly Haven', 'clay_block_wall', f'{PH}/clay_block_wall/diff.jpg', f'{PH}/clay_block_wall/nor.jpg', f'{PH}/clay_block_wall/arm.jpg', 'G', {'level': 158, 'desat': 0.15, 'nsize': 512}),
  'galets': ('Poly Haven', 'dry_river_pebbles', f'{PH}/dry_river_pebbles/diff.jpg', f'{PH}/dry_river_pebbles/nor.jpg', f'{PH}/dry_river_pebbles/arm.jpg', 'G', {'level': 150, 'desat': 0.35, 'nsize': 512, 'mul': (1.08, 1.0, 0.9)}),
  'vase': ('Poly Haven', 'mud_cracked_dry_riverbed_002', f'{PH}/mud_cracked_dry_riverbed_002/diff.jpg', f'{PH}/mud_cracked_dry_riverbed_002/nor.jpg', f'{PH}/mud_cracked_dry_riverbed_002/arm.jpg', 'G', {'level': 158, 'desat': 0.1, 'nsize': 512}),
  # objets de toutes les cartes (octobre 2026, demande du propriétaire : de vraies textures sur tous les assets) : caisses, toiles,
  # jute (sacs, bottes), bois peint (portes, volets, bardages), carton, acier, rouille, rideaux métalliques. rgb : couleur moyenne visée (sRGB), celle de la surface
  # procédurale qu'elles remplacent (mesurée dans le jeu), pour que les teintes posées par les sommets restent justes ; metal : le canal
  # bleu de la rugosité porte le masque de métal (arm.B), relu par texLabPack pour les matières à masque (ma) ; size : taille de la surface
  # procédurale remplacée, sans mémoire graphique de plus
  # bois massif des poteaux, poutres, lisses et bois ronds (sans joints de planches : la photo de planches, posée sur un poteau de 15 cm, y
  # dessinait des joints qui en faisaient le tour) et écorce des palmiers
  'timber': ('Poly Haven', 'rough_wood', f'{PH}/rough_wood/diff.jpg', f'{PH}/rough_wood/nor.jpg', f'{PH}/rough_wood/arm.jpg', 'G', {'level': 0, 'desat': 0.2, 'rgb': (176, 148, 120), 'size': 512}),
  'palmbark': ('Poly Haven', 'palm_tree_bark', f'{PH}/palm_tree_bark/diff.jpg', f'{PH}/palm_tree_bark/nor.jpg', f'{PH}/palm_tree_bark/arm.jpg', 'G', {'level': 0, 'desat': 0.3, 'rgb': (119, 93, 64), 'size': 512}),
  # caisses, palettes, cageots : des planches de bois brut larges (six par face de caisse), nœuds et trous de clous (octobre 2026 : le mur de
  # lattes fines d'avant, raw_plank_wall, en dessinait une douzaine par face, comme une tôle ondulée)
  'crate': ('Poly Haven', 'brown_planks_09', f'{PH}/brown_planks_09/diff.jpg', f'{PH}/brown_planks_09/nor.jpg', f'{PH}/brown_planks_09/arm.jpg', 'G', {'level': 0, 'desat': 0.15, 'rgb': (167, 133, 88), 'size': 512}),
  # tissus (chantier des tissus, octobre 2026) : une vraie toile épaisse au tissage lâche pour les tentes, bâches, stores et étals (le lin fin
  # d'avant ne se lisait pas à deux mètres), le lin d'avant pour le linge (un jersey de coton, essayé, était uni à cette taille), une laine tissée pour les tentes bédouines et les tapis
  'canvas': ('ambientCG', 'Fabric066', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_Color.jpg', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_NormalGL.jpg', f'{AC}/Fabric066_2K-JPG/Fabric066_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'linge': ('Poly Haven', 'rough_linen', f'{PH}/rough_linen/diff.jpg', f'{PH}/rough_linen/nor.jpg', f'{PH}/rough_linen/arm.jpg', 'G', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'laine': ('ambientCG', 'Fabric031', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_Color.jpg', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_NormalGL.jpg', f'{AC}/Fabric031_2K-JPG/Fabric031_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 1.0, 'rgb': (231, 229, 224), 'size': 512}),
  'burlap': ('Poly Haven', 'hessian_230', f'{PH}/hessian_230/diff.jpg', f'{PH}/hessian_230/nor.jpg', f'{PH}/hessian_230/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'rgb': (159, 135, 95), 'size': 512}),
  'paintwood': ('Poly Haven', 'distressed_painted_planks', f'{PH}/distressed_painted_planks/diff.jpg', f'{PH}/distressed_painted_planks/nor.jpg', f'{PH}/distressed_painted_planks/arm.jpg', 'G', {'level': 0, 'desat': 0.55, 'rgb': (210, 209, 208), 'size': 512}),
  'cardboard': ('ambientCG', 'Cardboard004', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_Color.jpg', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_NormalGL.jpg', f'{AC}/Cardboard004_2K-JPG/Cardboard004_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 0.0, 'rgb': (183, 143, 96), 'nsize': 512, 'size': 256}),
  'rust': ('Poly Haven', 'rust_coarse_01', f'{PH}/rust_coarse_01/diff.jpg', f'{PH}/rust_coarse_01/nor.jpg', f'{PH}/rust_coarse_01/arm.jpg', 'G', {'level': 0, 'desat': 0.0, 'rgb': (111, 58, 24), 'metal': True, 'size': 512}),
  'steel': ('ambientCG', 'Metal062C', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Color.jpg', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_NormalGL.jpg', f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Roughness.jpg', 'L', {'level': 0, 'desat': 0.8, 'rgb': (196, 197, 199), 'metal': f'{AC}/Metal062C_2K-JPG/Metal062C_2K-JPG_Metalness.jpg', 'size': 512}),
  'rollshutter': ('Poly Haven', 'rusty_metal_shutter', f'{PH}/rusty_metal_shutter/diff.jpg', f'{PH}/rusty_metal_shutter/nor.jpg', f'{PH}/rusty_metal_shutter/arm.jpg', 'G', {'level': 0, 'desat': 0.85, 'rgb': (207, 206, 206), 'metal': True, 'size': 512}),
}
SIZE = {'map': 1024, 'normal': 1024, 'rough': 512}
Q = {'map': 80, 'normal': 82, 'rough': 76}

def webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()

# crédits : ceux déjà construits sont gardés ; une surface dont les sources ne sont pas sur le disque (assets_src/ est ignoré par git) garde
# ses fichiers de assets/tex/ tels quels
CRED = ROOT / 'assets' / 'tex' / 'credits.json'
credits, total = (json.load(open(CRED, encoding='utf-8')) if CRED.exists() else []), 0
ONLY = [k for k in os.environ.get('ONLY', '').split(',') if k] # ONLY=reg,sand : ne refaire que ces surfaces
for key, (src, name, fc, fn, fr, ch, opt) in SETS.items():
    if ONLY and key not in ONLY: continue
    if not all(os.path.exists(f) for f in (fc, fn, fr)):
        print(f'{key:10s} sources absentes : assets/tex/{key} gardé'); continue
    c = Image.open(fc).convert('RGB').resize((opt.get('size', SIZE['map']),) * 2, Image.LANCZOS)
    if opt['desat']:
        g = ImageOps.grayscale(c).convert('RGB'); c = Image.blend(c, g, opt['desat'])
    if opt.get('mul'): # teinte (pelouse de Stratus : plus verte, comme ses brins)
        k3 = opt['mul']; c = Image.merge('RGB', [ch.point(lambda v, k=k: max(0, min(255, int(v * k)))) for ch, k in zip(c.split(), k3)])
    if opt.get('rgb'): # couleur moyenne visée, canal par canal
        st = ImageStat.Stat(c).mean
        c = Image.merge('RGB', [ch.point(lambda v, k=t / max(m, 1): max(0, min(255, int(v * k)))) for ch, t, m in zip(c.split(), opt['rgb'], st)])
    if opt['level']:
        m = sum(ImageStat.Stat(c).mean) / 3; k = opt['level'] / max(m, 1)
        c = c.point(lambda v: max(0, min(255, int(v * k))))
    n = Image.open(fn).convert('RGB').resize((opt.get('nsize', opt.get('size', SIZE['normal'])),) * 2, Image.LANCZOS) # nsize : relief plus petit (couches de sol)
    r = Image.open(fr)
    rr = (r.convert('RGB').split()[1] if ch == 'G' else r.convert('L')).resize((min(SIZE['rough'], opt.get('size', 1024)),) * 2, Image.LANCZOS)
    mt = rr
    if opt.get('metal'): # arm.B (Poly Haven), ou la carte de métal à part (ambientCG : metal = son chemin)
        mt = (Image.open(opt['metal']).convert('L') if isinstance(opt['metal'], str) else r.convert('RGB').split()[2]).resize((min(SIZE['rough'], opt.get('size', 1024)),) * 2, Image.LANCZOS)
    r = Image.merge('RGB', (rr, rr, mt))
    d = ROOT / 'assets' / 'tex' / key; os.makedirs(d, exist_ok=True); sizes = {}
    for kind, im in (('map', c), ('normal', n), ('rough', r)):
        data = webp(im, Q[kind]); total += len(data); sizes[kind] = len(data) // 1024
        open(d / (kind + '.webp'), 'wb').write(data)
    credits = [c for c in credits if c['key'] != key] + [{'key': key, 'asset': name, 'source': src, 'licence': 'CC0 1.0'}]
    print(f'{key:10s} {name:26s} {src:10s}', sizes, 'Ko')
open(CRED, 'w', encoding='utf-8').write(json.dumps(credits, ensure_ascii=False, indent=1) + '\n')
print('total', total // 1024, 'Ko')

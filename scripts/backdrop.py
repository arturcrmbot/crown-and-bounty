"""Repaints one of the game's own scenes with the kcpix style model, locally:  python backdrop.py court --strength 0.5 --seeds 1,2,3

The style model (an SDXL LoRA trained on our sheets and on screens from HoMM I and II) and its Python setup stay on
Artur's Mac in ~/.local/share/kc-imagegen and never go in the repo; run this with that setup's Python
(~/.local/share/kc-imagegen/.venv/bin/python). The source is the scene as the code draws it with nobody in it,
`<name>-src.png` there (the court's room before its people, the title's base before the castle, riders and name), so the
painting keeps everything where it stood. Each take is snapped to the game's palette at the view's size (928x464); the
chosen one goes in public/assets/backdrops/<name>.png as an indexed PNG. See public/assets/CREDITS.md.
"""
import json, os, subprocess, sys
import numpy as np, torch
from PIL import Image
from diffusers import AutoencoderKL, StableDiffusionXLImg2ImgPipeline

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser('~/.local/share/kc-imagegen')
STEP = '3200'
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
W, H = 928, 464
PROMPTS = {
    'court': 'kcpix, a royal throne hall inside a castle, warm sandstone walls and pillars, two red banners with gold crowns, '
             'a blue cloth of estate in an arch, a red carpet up stone steps, a tall arched window, torches, two guards, flagstone floor',
    'title': 'kcpix, a wide landscape at sunset, a road winding through green fields and hedges, a river, lilac mountains, '
             'a golden and purple sky with clouds, big trees at both edges, open sky across the top',
}
# What the game draws over each, so the painting mustn't have its own.
NEGS = {'court': 'king, throne, goose, bird', 'title': 'castle, tower, building, house, people, rider, horse'}
NEG = 'photo, realistic, 3d render, blurry, text, letters, watermark, frame, border, modern, car'


def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(np.maximum(c @ m1.T, 0))
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ m2.T


def palette():
    js = "import('./src/render/palette.ts').then(m=>{const c=new Set([...m.CYCLING]);console.log(JSON.stringify(m.COLORS.filter((_,i)=>i>0&&!c.has(i)&&i!==m.SILHOUETTE)))})"
    out = subprocess.run(['npx', 'tsx', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return np.array(json.loads(out.strip().splitlines()[-1]), float)


def snap(img, pal):
    lab, flat = oklab(pal), oklab(np.asarray(img.convert('RGB')).reshape(-1, 3).astype(float))
    out = np.empty(len(flat), int)
    for s in range(0, len(flat), 16384):
        out[s:s + 16384] = ((flat[s:s + 16384, None] - lab[None]) ** 2).sum(2).argmin(1)
    return Image.fromarray(pal[out].reshape(H, W, 3).astype('uint8'))


if __name__ == '__main__':
    name = sys.argv[1]
    strength, seeds = arg('--strength', 0.5), [int(s) for s in arg('--seeds', '1,2,3').split(',')]
    pal = palette()
    vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=torch.float16)
    p = StableDiffusionXLImg2ImgPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', vae=vae, torch_dtype=torch.float16,
                                                         variant='fp16', use_safetensors=True).to('mps')
    p.load_lora_weights(f'{HOME}/lora', weight_name=f'kcpix-{STEP}.safetensors', adapter_name='kc')
    src = Image.open(f'{HOME}/out/{name}-src.png').convert('RGB').crop((16, 16, 16 + W, 16 + H)).resize((1280, 640), Image.LANCZOS)
    os.makedirs(f'{HOME}/out/backdrops', exist_ok=True)
    for seed in seeds:
        img = p(PROMPTS[name], image=src, strength=strength, negative_prompt=f'{NEG}, {NEGS[name]}', num_inference_steps=40,
                guidance_scale=6.5, generator=torch.Generator('cpu').manual_seed(seed)).images[0]
        out = f'{HOME}/out/backdrops/{name}-{STEP}-st{strength}-s{seed}.png'
        snap(img.resize((W, H), Image.LANCZOS), pal).save(out)
        print(out, flush=True)

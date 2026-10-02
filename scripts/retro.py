"""Draws a sheet for the painted art with Retro Diffusion (#178, #255):  python3 scripts/retro.py art/map/jobs/units-e.json

Each job is Retro Diffusion's own request (prompt, prompt_style, width, height, num_images, seed, reference_images) and
`out`, where the sheet goes. References are paths (`~` is the home folder). HoMM2's screenshots stay on this Mac, in
~/.config/retro-diffusion/refs/, and never go in the repo. The key is read from ~/.config/retro-diffusion/key, never from
the repo. `npm run mapart` then cuts the sheet: see .github/skills/kings-commission-mapart/SKILL.md.
"""
import base64, json, os, sys, time, urllib.request, uuid

API = 'https://api.retrodiffusion.ai/v2'
KEY = open(os.path.expanduser('~/.config/retro-diffusion/key')).read().strip()


def call(method, path, body=None):
    headers = {'X-RD-Token': KEY, 'Content-Type': 'application/json', 'Idempotency-Key': str(uuid.uuid4())}
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(urllib.request.Request(API + path, data=data, headers=headers, method=method), timeout=120) as r:
        return json.load(r)


def draw(job):
    job = dict(job)
    out = job.pop('out')
    job['reference_images'] = [base64.b64encode(open(os.path.expanduser(p), 'rb').read()).decode() for p in job.get('reference_images', [])]
    task = call('POST', '/inferences', job)['task_id']
    while (r := call('GET', f'/inferences/tasks/{task}'))['status'] in ('pending', 'running'):
        time.sleep(3)
    if r['status'] == 'failed':
        raise SystemExit(f"{out}: {r.get('error')}")
    result = r['result']
    names = [out if i == 0 else out.replace('.png', f'-{i}.png') for i in range(job.get('num_images', 1))]
    for name, image in zip(names, result.get('base64_images') or []):
        open(name, 'wb').write(base64.b64decode(image))
    for name, url in zip(names, result.get('output_urls') or []):
        urllib.request.urlretrieve(url, name)
    print(out, 'cost', result.get('balance_cost'), 'left', result.get('remaining_balance'))


if __name__ == '__main__':
    for job in json.load(open(sys.argv[1])):
        draw(job)

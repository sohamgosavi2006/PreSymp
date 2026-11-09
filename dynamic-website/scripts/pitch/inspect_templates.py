import zipfile
import xml.etree.ElementTree as E
import json
from pathlib import Path

ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
paths = [Path('C:/Users/rakes/Downloads/Two-page Solution Brief Template.pptx'), Path('C:/Users/rakes/Downloads/PPT_Final_Teamplate_Health-a-thon 2026.pptx')]
out = Path('artifacts/pitch/.build')
out.mkdir(parents=True, exist_ok=True)
for path in paths:
    deck = []
    with zipfile.ZipFile(path) as z:
        size = E.fromstring(z.read('ppt/presentation.xml')).find('p:sldSz', ns).attrib
        files = sorted([x for x in z.namelist() if x.startswith('ppt/slides/slide') and x.endswith('.xml')], key=lambda x: int(x.split('slide')[-1].split('.')[0]))
        for file in files:
            shapes = []
            root = E.fromstring(z.read(file))
            for sp in root.findall('.//p:sp', ns):
                nv = sp.find('p:nvSpPr/p:cNvPr', ns)
                xfrm = sp.find('p:spPr/a:xfrm', ns)
                shapes.append({'name': nv.get('name'), 'id': nv.get('id'), 'text': '\n'.join(t.text or '' for t in sp.findall('.//a:t', ns)), 'position': E.tostring(xfrm, encoding='unicode') if xfrm is not None else '', 'fonts': [r.attrib for r in sp.findall('.//a:rPr', ns)]})
            notes_path = file.replace('/slides/slide', '/notesSlides/notesSlide')
            notes = '\n'.join(t.text or '' for t in E.fromstring(z.read(notes_path)).findall('.//a:t', ns)) if notes_path in z.namelist() else ''
            deck.append({'file': file, 'shapes': shapes, 'notes': notes})
        record = {'path': str(path), 'size': size, 'slides': deck}
        (out / (path.stem + '.json')).write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding='utf-8')
        print(json.dumps(record, ensure_ascii=True))

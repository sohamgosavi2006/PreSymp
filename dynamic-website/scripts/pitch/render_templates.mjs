import fs from 'node:fs/promises'
import path from 'node:path'
import { PresentationFile, FileBlob } from 'file:///C:/Users/rakes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'
const root = path.resolve('artifacts/pitch/.build')
for (const [name, file] of [['brief','Two-page Solution Brief Template.pptx'],['final','PPT_Final_Teamplate_Health-a-thon 2026.pptx']]) {
  const presentation = await PresentationFile.importPptx(await FileBlob.load(path.join('C:/Users/rakes/Downloads',file)))
  const dir = path.join(root,`${name}-reference`)
  await fs.mkdir(dir,{recursive:true})
  await fs.writeFile(path.join(root,`${name}-proto.json`), JSON.stringify(presentation.toProto()))
  const inspected = await presentation.inspect({select:'$.slides[*]',include:['id','index','layout','elements.id','elements.name','elements.kind','elements.text','elements.position','elements.style']})
  await fs.writeFile(path.join(root,`${name}-inspect.json`),JSON.stringify(inspected.records,null,2))
  for (const [i,slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({slide,format:'png',scale:1})
    await fs.writeFile(path.join(dir,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()))
    console.log(`${name} source slide ${i+1} rendered`)
  }
}

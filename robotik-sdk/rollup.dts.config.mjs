// 将 tsc 生成的多文件声明 bundle 成单个 dist/index.d.ts，
// 只保留从入口可达的公共 API，tree-shake 掉内部实现类型。
import { dts } from 'rollup-plugin-dts'
import { rollup } from 'rollup'

const bundle = await rollup({
  input: '.dts-tmp/index.d.ts',
  plugins: [dts()],
})

await bundle.write({
  file: 'dist/index.d.ts',
  format: 'es',
})

await bundle.close()

let fs = require('fs')
let PNG = require('pngjs').PNG
let PCX = require('pcx-js')
let args = require('args')

let output_raw = true
let output_textures = true
let output_palettes = true
let output_backgrounds = true
let output_models = true
let output_sounds = true
let output_briefings = true
let output_surfaces = true
let output_font = true
let output_maps = true

//TODO digitest.raw (Its a sound I think)
//TODO levels

// let output_dir = null
// let converted_dir = "./converted"
// let converted_pcx_dir = null
// let converted_pal_dir = null
// let converted_snd_dir = null
// let converted_briefing_dir = null
// let converted_model_dir = null
// let converted_map_dir = null

// args
//   .option('rawdir', 'Main output directory for raw extracted files', './output/')
//   .option('reload', 'Enable/disable livereloading')
//   .command('serve', 'Serve your static site', ['s'])
 
// const flags = args.parse(process.argv)

// for (let i = 0; i < process.argv.length; ++i)
// {
//     let arg = process.argv[i]
//     if (arg == "-d" || arg == "--directory")
//     {

//     }
// }
// process.argv.forEach(arg =>
// {
//     if (arg == "all")
//     {
//         converted_pcx_dir = "./converted"
//     }
// })

// Extract HOG files
let palette = null
let hog_files = []

{
    let file_data = fs.readFileSync("./input/DESCENT.HOG")
    let file_offset = 3
    let sig = file_data.toString('latin1', 0, 3)
    if (sig != "DHF")
    {
        console.log("HOG file not DHF")
        process.exit(1)
    }
    while (file_offset < file_data.length)
    {
        let file = {}
        file.file_name = file_data.toString('binary', file_offset, file_offset + 13)
        file.file_name = file.file_name.substr(0, file.file_name.indexOf('.') + 4)
        file.type = file.file_name.substr(file.file_name.indexOf('.') + 1)
        file_offset += 13
        file.file_size = file_data.readInt32LE(file_offset)
        file_offset += 4
        file.data = file_data.subarray(file_offset, file_offset + file.file_size)
        file_offset += file.file_size

        console.log(`${file.file_name} [${file.file_size} B]`)

        hog_files.push(file)

        if (output_raw)
        {
            fs.writeFileSync(`./output/${file.file_name}`, file.data)
        }
    }
}

// Save PCX
if (output_backgrounds)
{
    hog_files.filter(file => file.type == "pcx").forEach(file =>
    {
        let pcx = new PCX(file.data).decode()
        let png = new PNG({width: pcx.width, height: pcx.height})
        for (let i = 0; i < pcx.width * pcx.height * 4; ++i)
        {
            png.data[i] = pcx.pixelArray[i]
        }

        file.image_data = png.data

        let buffer = PNG.sync.write(png)
        fs.writeFileSync(`./converted/backgrounds/${file.file_name}.png`, buffer)
    })
}

// Save palette
if (output_palettes || output_textures)
{
    hog_files.filter(file => file.type == "256").forEach(file =>
    {
        let png = new PNG({width: 16, height: 16 * 35})

        for (let i = 0; i < 256; ++i)
        {
            png.data[i * 4 + 0] = file.data.readUInt8(i * 3 + 0) * 4
            png.data[i * 4 + 1] = file.data.readUInt8(i * 3 + 1) * 4
            png.data[i * 4 + 2] = file.data.readUInt8(i * 3 + 2) * 4
            png.data[i * 4 + 3] = 255
        }

        png.data[254 * 4 + 3] = 0
        png.data[255 * 4 + 3] = 0

        for (let l = 0; l < 34; ++l)
        {
            for (let i = 0; i < 256; ++i)
            {
                let idx = file.data.readUInt8(l * 256 + 768 + i)
                png.data[l * 256 * 4 + 256 * 4 + i * 4 + 0] = png.data[idx * 4 + 0]
                png.data[l * 256 * 4 + 256 * 4 + i * 4 + 1] = png.data[idx * 4 + 1]
                png.data[l * 256 * 4 + 256 * 4 + i * 4 + 2] = png.data[idx * 4 + 2]
                png.data[l * 256 * 4 + 256 * 4 + i * 4 + 3] = png.data[idx * 4 + 3]
            }
        }

        file.image_data = png.data
        
        if (output_palettes)
        {
            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/palettes/${file.file_name}.png`, buffer)
        }

        if (file.file_name == "palette.256")
        {
            palette = file.image_data
        }
    })
}

function FIX(fix)
{
    return (fix >> 16) + ((fix & 0xFFFF) / 65536)
}

function FIX16(fix)
{
    return (fix >> 8) + ((fix & 0xFF) / 256)
}

let textures = []
let sounds = []

if (output_sounds || output_textures)
{
    let file_data = fs.readFileSync("./input/DESCENT.PIG")
    let file_offset = 0

    file_offset = file_data.readInt32LE(file_offset)

    let num_textures = file_data.readInt32LE(file_offset)
    file_offset += 4
    let num_sounds = file_data.readInt16LE(file_offset)
    file_offset += 4

    console.log(`num_textures: ${num_textures}`)
    console.log(`num_sounds: ${num_sounds}`)

    for (let i = 0; i < num_textures; ++i)
    {
        let texture = {}
        texture.name = ""
        for (let j = 0; j < 8; ++j)
        {
            let c = file_data.readUInt8(file_offset++)
            if (c == 0)
            {
                while (j < 7)
                {
                    file_data.readUInt8(file_offset++)
                    ++j
                }
                break
            }
            texture.name += String.fromCharCode(c)
        }
        let frame = file_data.readUInt8(file_offset++)
        texture.frame = frame & 0x1F
        texture.abmFlag = (frame & 0x20) ? true : false
        texture.xsize = file_data.readUInt8(file_offset++)
        texture.ysize = file_data.readUInt8(file_offset++)
        texture.flag = file_data.readUInt8(file_offset++)
        texture.ave_color = file_data.readUInt8(file_offset++)
        texture.offset = file_data.readUInt32LE(file_offset)
        file_offset += 4
        console.log(`texture ${JSON.stringify(texture)}`)
        textures.push(texture)
    }

    for (let i = 0; i < num_sounds; ++i)
    {
        let sound = {}
        sound.name = ""
        for (let j = 0; j < 8; ++j)
        {
            let c = file_data.readUInt8(file_offset++)
            if (c == 0)
            {
                while (j < 7)
                {
                    file_data.readUInt8(file_offset++)
                    ++j
                }
                break
            }
            sound.name += String.fromCharCode(c)
        }
        sound.nSamples = file_data.readInt32LE(file_offset)
        file_offset += 4
        sound.data_length = file_data.readInt32LE(file_offset)
        file_offset += 4
        sound.offset = file_data.readInt32LE(file_offset)
        file_offset += 4
        console.log(`sound ${JSON.stringify(sound)}`)
        sounds.push(sound)
    }

    textures.forEach(file =>
    {
        file.data = file_data.subarray(file_offset + file.offset)
    })
    sounds.forEach(file =>
    {
        file.data = file_data.subarray(file_offset + file.offset)
    })
}

if (output_textures)
{
    const BM_FLAG_TRANSPARENT = 1
    const BM_FLAG_SUPER_TRANSPARENT = 2
    const BM_FLAG_NO_LIGHTING = 4
    const BM_FLAG_RLE = 8
    const BM_FLAG_PAGED_OUT = 16
    const BM_FLAG_RLE_BIG = 32

    let t = 0
    textures.forEach(texture =>
    {
        process.stdout.write(`\rconverting textures ${t}/${textures.length}`)
        ++t

        let isCompressed = (texture.flag & BM_FLAG_RLE)|| (texture.flag & BM_FLAG_RLE_BIG)
        if (!isCompressed)
        {
            // Raw
            let png = new PNG({width: texture.xsize, height: texture.ysize})
            for (let i = 0; i < texture.xsize * texture.ysize; ++i)
            {
                png.data[i * 4 + 0] = palette[texture.data.readUInt8(i) * 4 + 0]
                png.data[i * 4 + 1] = palette[texture.data.readUInt8(i) * 4 + 1]
                png.data[i * 4 + 2] = palette[texture.data.readUInt8(i) * 4 + 2]
                png.data[i * 4 + 3] = palette[texture.data.readUInt8(i) * 4 + 3]
            }
            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/textures/${texture.name}_${texture.frame}.png`, buffer)    
        }
        else if (texture.flag & BM_FLAG_RLE)
        {
            let offset = 0
            texture.total_size = texture.data.readUInt32LE(offset)
            offset += 4
            texture.line_sizes = []
            for (let i = 0; i < texture.ysize; ++i)
            {
                texture.line_sizes.push(texture.data.readUInt8(offset++))
            }

            let dataSize = texture.line_sizes.reduce((size, line) => size + line, 0)
            let png = new PNG({width: texture.xsize, height: texture.ysize})
            let i = 0
            while (offset < texture.data.length)
            {
                let repeat = texture.data.readUInt8(offset++)
                if (repeat & 0x80 && repeat & 0x40 && repeat & 0x20)
                {
                    repeat &= 0x1F
                    if (repeat)
                    {
                        let byte = texture.data.readUInt8(offset++)
                        for (let j = 0; j < repeat; ++j)
                        {
                            png.data[i * 4 + 0] = palette[byte * 4 + 0]
                            png.data[i * 4 + 1] = palette[byte * 4 + 1]
                            png.data[i * 4 + 2] = palette[byte * 4 + 2]
                            png.data[i * 4 + 3] = palette[byte * 4 + 3]
                            ++i
                        }
                    }
                }
                else
                {
                    byte = repeat
                    png.data[i * 4 + 0] = palette[byte * 4 + 0]
                    png.data[i * 4 + 1] = palette[byte * 4 + 1]
                    png.data[i * 4 + 2] = palette[byte * 4 + 2]
                    png.data[i * 4 + 3] = palette[byte * 4 + 3]
                    ++i
                }
            }

            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/textures/${texture.name}_${texture.frame}.png`, buffer)
        }
        else if (texture.flag & BM_FLAG_RLE_BIG)
        {
            let offset = 0
            texture.total_size = texture.data.readUInt32LE(offset)
            offset += 4
            texture.line_sizes = []
            for (let i = 0; i < texture.ysize; ++i)
            {
                texture.line_sizes.push(texture.data.readUInt16LE())
                offset += 2
            }

            let dataSize = texture.line_sizes.reduce((size, line) => size + line, 0)
            let png = new PNG({width: texture.xsize, height: texture.ysize})
            let i = 0
            while (offset < texture.data.length)
            {
                let repeat = texture.data.readUInt8(offset++)
                if (repeat & 0x80 && repeat & 0x40 && repeat & 0x20)
                {
                    repeat &= 0x1F
                    if (repeat)
                    {
                        let byte = texture.data.readUInt8(offset++)
                        for (let j = 0; j < repeat; ++j)
                        {
                            png.data[i * 4 + 0] = palette[byte * 4 + 0]
                            png.data[i * 4 + 1] = palette[byte * 4 + 1]
                            png.data[i * 4 + 2] = palette[byte * 4 + 2]
                            png.data[i * 4 + 3] = palette[byte * 4 + 3]
                            ++i
                        }
                    }
                }
                else
                {
                    byte = repeat
                    png.data[i * 4 + 0] = palette[byte * 4 + 0]
                    png.data[i * 4 + 1] = palette[byte * 4 + 1]
                    png.data[i * 4 + 2] = palette[byte * 4 + 2]
                    png.data[i * 4 + 3] = palette[byte * 4 + 3]
                    ++i
                }
            }

            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/textures/${texture.name}_${texture.frame}.png`, buffer)

            process.exit(0)
        }
    })
}

// 3D models
if (output_models)
{
    hog_files.filter(file => file.type == "pof").forEach(file =>
    {
        console.log(`converting ${file.file_name}`)
        let file_offset = 0
        let json = {}
        json.models = []
        let modelsOffset = []
        while (file_offset < file.data.length)
        {
            let id = file.data.toString('binary', file_offset, file_offset + 4)
            file_offset += 4

            switch (id)
            {
                case "PSPO":
                {
                    json.version = file.data.readInt16LE(file_offset)
                    file_offset += 2
                    break
                }
                case "TXTR":
                {
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    let strCount = file.data.readInt16LE(file_offset)
                    file_offset += 2
                    json.textures = []
                    for (let i = 0; i < strCount; ++i)
                    {
                        let texture = ""
                        while (true)
                        {
                            let c = file.data.readUInt8(file_offset++)
                            if (c == 0) break
                            texture += String.fromCharCode(c)
                        }
                        json.textures.push(texture)
                    }
                    break
                }
                case "OHDR":
                {
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    json.numModels = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    json.modelRad = FIX(file.data.readInt32LE(file_offset))
                    file_offset += 4
                    json.min = {
                        x: FIX(file.data.readInt32LE(file_offset)),
                        y: FIX(file.data.readInt32LE(file_offset + 4)),
                        z: FIX(file.data.readInt32LE(file_offset + 8))
                    }
                    file_offset += 12
                    json.max = {
                        x: FIX(file.data.readInt32LE(file_offset)),
                        y: FIX(file.data.readInt32LE(file_offset + 4)),
                        z: FIX(file.data.readInt32LE(file_offset + 8))
                    }
                    file_offset += 12
                    break
                }
                case "SOBJ":
                {
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    let model = {}
                    model.subNum = file.data.readInt16LE(file_offset)
                    file_offset += 2
                    model.parentNum = file.data.readInt16LE(file_offset)
                    file_offset += 2
                    model.subPlaneNorm = {
                        x: FIX(file.data.readInt32LE(file_offset)),
                        y: FIX(file.data.readInt32LE(file_offset + 4)),
                        z: FIX(file.data.readInt32LE(file_offset + 8))
                    }
                    file_offset += 12
                    model.subPlanePnt = {
                        x: FIX(file.data.readInt32LE(file_offset)),
                        y: FIX(file.data.readInt32LE(file_offset + 4)),
                        z: FIX(file.data.readInt32LE(file_offset + 8))
                    }
                    file_offset += 12
                    model.subOffset = {
                        x: FIX(file.data.readInt32LE(file_offset)),
                        y: FIX(file.data.readInt32LE(file_offset + 4)),
                        z: FIX(file.data.readInt32LE(file_offset + 8))
                    }
                    file_offset += 12
                    json.modelRad = FIX(file.data.readInt32LE(file_offset))
                    file_offset += 4
                    modelsOffset.push(file.data.readInt32LE(file_offset))
                    file_offset += 4
                    json.models.push(model)
                    break
                }
                case "GUNS":
                {
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    json.numGuns = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    json.guns = []
                    for (let i = 0; i < json.numGuns; ++i)
                    {
                        let gun = {}
                        gun.gunID = file.data.readInt16LE(file_offset)
                        file_offset += 2
                        gun.gunSub = file.data.readInt16LE(file_offset)
                        file_offset += 2
                        gun.gunPoint = {
                            x: FIX(file.data.readInt32LE(file_offset)),
                            y: FIX(file.data.readInt32LE(file_offset + 4)),
                            z: FIX(file.data.readInt32LE(file_offset + 8))
                        }
                        file_offset += 12
                        gun.fireVector = {
                            x: FIX(file.data.readInt32LE(file_offset)),
                            y: FIX(file.data.readInt32LE(file_offset + 4)),
                            z: FIX(file.data.readInt32LE(file_offset + 8))
                        }
                        file_offset += 12
                        json.guns.push(gun)
                    }
                    break
                }
                // case "ANIM":
                // {
                //     let size = file.data.readInt32LE(file_offset)
                //     file_offset += 4
                //     json.numFrames = file.data.readInt16LE(file_offset)
                //     file_offset += 2
                //     console.log("size: " + size)
                //     console.log("json.numFrames: " + json.numFrames)
                //     console.log("json.numModels: " + json.numModels)
                //     json.anim_angs = []
                //     for (let i = 0; i < json.numModels; ++i)
                //     {
                //         let frames = []
                //         for (let j = 0; j < json.numFrames; ++j)
                //         {
                //             frames.push(FIX16(file.data.readInt16LE(file_offset)))
                //             file_offset += 2
                //         }
                //         json.anim_angs.push(frames)
                //     }
                //     break
                // }
                case "IDTA":
                {
                    let obj = `mtllib ${file.file_name}.mtl\n`
                    let mtl = ``
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    let data = file.data.subarray(file_offset, file_offset + size)
                    file_offset += size
                    let offset = 0
                    let materials = {}
                    let uvlVector = []
                    while (offset < size)
                    {
                        let id = data.readInt16LE(offset)
                        offset += 2
                        switch (id)
                        {
                            case 0:
                            {
                                // 0 - EOF - Means end of tree reached
                                // + 0 short id = 0
                                // console.log("  EOF {}")
                                break
                            }
                            case 1:
                            {
                                // + 0 short id = 1
                                let DEFPOINTS = {}
                
                                // + 2 short n_Points
                                DEFPOINTS.n_Points = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 VMS_VECTOR points[n_Points]
                                DEFPOINTS.points = []
                                for (let i = 0; i < DEFPOINTS.n_Points; ++i)
                                {
                                    let pt = {
                                        x: FIX(data.readInt32LE(offset)),
                                        y: FIX(data.readInt32LE(offset + 4)),
                                        z: FIX(data.readInt32LE(offset + 8))
                                    }
                                    DEFPOINTS.points.push(pt)
                                    offset += 12
                                    obj += `v ${pt.x} ${pt.y} ${pt.z}\n`
                                }
                
                                // console.log("  DEFPOINTS " + JSON.stringify(DEFPOINTS))
                                break
                            }
                            case 2:
                            {
                                // + 0 short id = 2
                                let FLATPOLY = {}
                
                                // + 2 short n_Points
                                FLATPOLY.n_Points = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 VMS_VECTOR vmsVector
                                FLATPOLY.vmsVector = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +16 VMS_VECTOR vmsNormal
                                FLATPOLY.vmsNormal = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +28 short colorMap
                                FLATPOLY.colorMap = data.readInt16LE(offset)
                                offset += 2
               
                                FLATPOLY.red = ((FLATPOLY.colorMap >> 10) & 0x3f) * 4;
                                FLATPOLY.green = ((FLATPOLY.colorMap >> 5) & 0x3f) * 4;
                                FLATPOLY.blue = (FLATPOLY.colorMap & 0x3f) * 4;
                                let matName = `R${FLATPOLY.red}G${FLATPOLY.green}B${FLATPOLY.blue}`

                                if (!materials.hasOwnProperty(matName))
                                {
                                    materials[matName] = true
                                    mtl += `newmtl ${matName}\nKa ${FLATPOLY.red/255} ${FLATPOLY.green/255} ${FLATPOLY.blue/255}\nKd ${FLATPOLY.red/255} ${FLATPOLY.green/255} ${FLATPOLY.blue/255}\n`
                                }
                                obj += `usemtl ${matName}\n`
                
                                // +30 short ptldx[n_Points]
                                FLATPOLY.ptldx = []
                                obj += `f`
                                for (let i = 0; i < FLATPOLY.n_Points; ++i)
                                {
                                    let ptidx = data.readInt16LE(offset)
                                    FLATPOLY.ptldx.push(ptidx)
                                    obj += ` ${ptidx+1}`
                                    offset += 2
                                }
                                obj += "\n"
                
                                // +.. if (!n_Points & 1)
                                //     short pad //Present only if n_Points is even
                                if (!(FLATPOLY.n_Points & 1))
                                {
                                    FLATPOLY.pad = data.readInt16LE(offset)
                                    offset += 2
                                }
                
                                // console.log("  FLATPOLY " + JSON.stringify(FLATPOLY))
                                break
                            }
                            case 3:
                            {
                                // + 0 short id = 3
                                let TMAPPOLY = {}
                
                                // + 2 short n_Points
                                TMAPPOLY.n_Points = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 VMS_VECTOR vmsVector
                                TMAPPOLY.vmsVector = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +16 VMS_VECTOR vmsNormal
                                TMAPPOLY.vmsNormal = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +28 short texture
                                TMAPPOLY.texture = data.readInt16LE(offset)
                                offset += 2

                                // Copy the texture file
                                let texture = json.textures[TMAPPOLY.texture] + '_0'
                                try
                                {
                                    fs.copyFileSync(`./converted/textures/${texture}.png`, __dirname + `/converted/models/${texture}.png`)
                                }
                                catch (e)
                                {
                                    // console.log(e)
                                }
                                if (!materials.hasOwnProperty(texture))
                                {
                                    materials[texture] = true
                                    mtl += `newmtl ${texture}\nmap_Kd ${texture}.png\n`
                                }
                                obj += `usemtl ${texture}\n`
                
                                // +30 short ptldx[n_Points]
                                TMAPPOLY.ptldx = []
                                for (let i = 0; i < TMAPPOLY.n_Points; ++i)
                                {
                                    let ptidx = data.readInt16LE(offset)
                                    TMAPPOLY.ptldx.push(ptidx)
                                    offset += 2
                                }
                
                                // +.. if (!n_Points & 1)
                                //     short pad //Present only if n_Points is even
                                if (!(TMAPPOLY.n_Points % 2))
                                {
                                    TMAPPOLY.pad = data.readInt16LE(offset)
                                    offset += 2
                                }
                
                                // +.. UVL_VECTOR uvlVector[n_Points] //Controls Texture Mapping
                                for (let i = 0; i < TMAPPOLY.n_Points; ++i)
                                {
                                    let uvw = {
                                        u: FIX(data.readInt32LE(offset)),
                                        v: FIX(data.readInt32LE(offset + 4)),
                                        w: FIX(data.readInt32LE(offset + 8))
                                    }
                                    offset += 12
                                    uvlVector.push(uvw)
                                    obj += `vt ${uvw.u} ${1 - uvw.v}\n`
                                }

                                obj += `f`
                                for (let i = 0; i < TMAPPOLY.ptldx.length; ++i)
                                {
                                    obj += ` ${TMAPPOLY.ptldx[i] + 1}/${uvlVector.length - TMAPPOLY.ptldx.length + i + 1}`
                                }
                                obj += "\n"
                
                                // console.log("  TMAPPOLY " + JSON.stringify(TMAPPOLY))
                                break
                            }
                            case 4:
                            {
                                // + 0 short id = 4
                                let SORTNORM = {}
                                
                                // + 2 short n_Points
                                SORTNORM.n_Points = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 VMS_VECTOR vmsVector
                                SORTNORM.vmsVector = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +16 VMS_VECTOR vmsNormal
                                SORTNORM.vmsNormal = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +28 short zFront
                                SORTNORM.zFront = data.readInt16LE(offset)
                                offset += 2
                
                                // +30 short zBack
                                SORTNORM.zBack = data.readInt16LE(offset)
                                offset += 2
                
                                // console.log("  SORTNORM " + JSON.stringify(SORTNORM))
                                break
                            }
                            case 6:
                            {
                                // + 0 short id = 6
                                let SUBCALL = {}
                
                                // + 2 short sobjNum
                                SUBCALL.sobjNum = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 VMS_VECTOR vmsStartPoint
                                SUBCALL.vmsStartPoint = {
                                    x: FIX(data.readInt32LE(offset)),
                                    y: FIX(data.readInt32LE(offset + 4)),
                                    z: FIX(data.readInt32LE(offset + 8))
                                }
                                offset += 12
                
                                // +16 short offset
                                SUBCALL._offset = data.readInt16LE(offset)
                                offset += 2
                
                                // +18 int pad
                                SUBCALL.pad = data.readInt32LE(offset)
                                offset += 4
                
                                // console.log("  SUBCALL " + JSON.stringify(SUBCALL))                    
                                break
                            }
                            case 7:
                            {
                                // + 0 short id = 7
                                let DEFP_START = {}
                
                                // + 2 short n_Points
                                DEFP_START.n_Points = data.readInt16LE(offset)
                                offset += 2
                
                                // + 4 short formerPts //=0 in main model, !=0 in submodels
                                DEFP_START.formerPts = data.readInt16LE(offset)
                                offset += 2
                
                                // + 6 short pad
                                DEFP_START.pad = data.readInt16LE(offset)
                                offset += 2
                
                                // + 8 VMS_VECTOR vmsPts[n_Points]
                                DEFP_START.vsmPts = []
                                for (let i = 0; i < DEFP_START.n_Points; ++i)
                                {
                                    let pt = {
                                        x: FIX(data.readInt32LE(offset)),
                                        y: FIX(data.readInt32LE(offset + 4)),
                                        z: FIX(data.readInt32LE(offset + 8))
                                    }
                                    DEFP_START.vsmPts.push(pt)
                                    offset += 12
                                    obj += `v ${pt.x} ${pt.y} ${pt.z}\n`
                                }
                
                                // console.log("  DEFP_START " + JSON.stringify(DEFP_START))
                                break
                            }
                            case 8:
                            {
                                // + 0 short id = 8
                                let GLOW = {}
                
                                // + 2 short glowVal
                                GLOW.glowVal = data.readInt16LE(offset)
                                offset += 2
                
                                // console.log("  GLOW " + JSON.stringify(GLOW))
                                break
                            }
                            default:
                            {
                                console.log("  invalid: " + id)
                                process.exit(0)
                            }
                        }
                    }

                    fs.writeFileSync(`./converted/models/${file.file_name}.obj`, obj)
                    fs.writeFileSync(`./converted/models/${file.file_name}.mtl`, mtl)
                    break;
                }
                default:
                    let size = file.data.readInt32LE(file_offset)
                    file_offset += 4
                    let data = file.data.subarray(file_offset, file_offset + size)
                    file_offset += size

                    console.log(`  Unhandled: [${id}]`)
                    break
            }
        }
        fs.writeFileSync(`./converted/models/${file.file_name}.json`, JSON.stringify(json, null, 2))
    })
}

if (output_briefings)
{
    hog_files.filter(file => file.type == "txb").forEach(file =>
    {
        console.log(`converting ${file.file_name}`)

        let output = ''
        for (let i = 0; i < file.data.length; ++i)
        {
            let c = file.data.readUInt8(i)
            if (c != 0x0a)
            {
                c = (((c & 0x3f) << 2) + ((c & 0xc0) >> 6)) ^ 0xa7;
            }
            output += String.fromCharCode(c)
        }

        fs.writeFileSync(`./converted/texts/${file.file_name}.txt`, output)
    })
}

if (output_surfaces)
{
    hog_files.filter(file => file.type == "bbm").forEach(file =>
    {
        console.log(`converting ${file.file_name}`)

        let main_offset = 0
        let chunkID = file.data.toString('binary', main_offset, main_offset + 4)
        main_offset += 4
        if (chunkID != "FORM")
        {
            console.log('  Expected FORM chunkID')
            return
        }
        let lenChunk = file.data.readUInt32BE(main_offset)
        main_offset += 4
        let formatID = file.data.toString('binary', main_offset, main_offset + 4)
        main_offset += 4
        if (formatID != "PBM ")
        {
            console.log('  Expected PBM formatID')
            return
        }
        let content = file.data.subarray(main_offset, main_offset + lenChunk - 4)
        main_offset += lenChunk - 4
        if (lenChunk % 2) file.data.readUInt8(main_offset++)

        let offset = 0
        let bmhd = {}
        let pal = null
        let x = 0
        let y = 0
        while (offset < content.length)
        {
            chunkID = content.toString('binary', offset, offset + 4)
            offset += 4
            lenChunk = file.data.readUInt32BE(offset)
            offset += 4

            switch (chunkID)
            {
                case "BMHD":
                {
                    bmhd.width = content.readUInt16BE(offset)
                    offset += 2
                    bmhd.height = content.readUInt16BE(offset)
                    offset += 2
                    bmhd.xOrigin = content.readInt16BE(offset)
                    offset += 2
                    bmhd.yOrigin = content.readInt16BE(offset)
                    offset += 2
                    bmhd.numPlanes = content.readUInt8(offset++)
                    bmhd.mask = content.readUInt8(offset++)
                    bmhd.compression = content.readUInt8(offset++)
                    bmhd.pad1 = content.readUInt8(offset++)
                    bmhd.transClr = content.readUInt16BE(offset)
                    offset += 2
                    bmhd.xAspect = content.readUInt8(offset++)
                    bmhd.yAspect = content.readUInt8(offset++)
                    bmhd.pageWidth = content.readInt16BE(offset)
                    offset += 2
                    bmhd.pageHeight = content.readInt16BE(offset)
                    offset += 2
        
                    // Validate only what we support
                    if (bmhd.numPlanes != 8 || bmhd.mask != 2 || bmhd.compression != 0)
                    {
                        console.log('  Unsupported BMHD format')
                        return
                    }
                    break
                }
                case "CMAP":
                {
                    pal = content.subarray(offset, offset + 256 * 3)
                    offset += 256 * 3
                    break;
                }
                case "GRAB":
                {
                    offset += 4
                    break;
                }
                case "CRNG":
                {
                    offset += 8
                    break;
                }
                case "TINY":
                {
                    let width = content.readUInt16BE(offset)
                    offset += 2
                    let height = content.readUInt16BE(offset)
                    offset += 2
                    offset += width * height
                    break;
                }
                case "BODY":
                {
                    let png = new PNG({width: bmhd.width, height: bmhd.height})
                    for (let i = 0; i < bmhd.width * bmhd.height; ++i)
                    {
                        let idx = content.readUInt8(offset++)
                        png.data[i * 4 + 0] = pal.readUInt8(idx * 3 + 0)
                        png.data[i * 4 + 1] = pal.readUInt8(idx * 3 + 1)
                        png.data[i * 4 + 2] = pal.readUInt8(idx * 3 + 2)
                        png.data[i * 4 + 3] = (idx == bmhd.transClr) ? 0 : 255
                    }

                    file.image_data = png.data

                    let buffer = PNG.sync.write(png)
                    fs.writeFileSync(`./converted/surfaces/${file.file_name}.png`, buffer)
                    return;
                }
                default:
                {
                    console.log(`  Unhandled sub chunk: ${chunkID}`)
                    return;
                }
            }
        }

        chunkID = file.data.toString('binary', main_offset, main_offset + 4)
        main_offset += 4
    })
}

const FT_COLOR = 1
const FT_PROPORTIONAL = 2
const FT_KERNED = 4

if (output_font)
{
    hog_files.filter(file => file.type == "fnt").forEach(file =>
    {
        console.log(`converting ${file.file_name}`)

        let offset = 0

        let sig = file.data.toString('binary', offset, offset + 4)
        offset += 4
        if (sig != "PSFN")
        {
            console.log(`  Expected "PSFN" signature`)
            return;
        }

        let data_size = file.data.readUInt32LE(offset)
        offset += 4

        let fnt = {}
        fnt.ft_w = file.data.readUInt16LE(offset)
        offset += 2
        fnt.ft_h = file.data.readUInt16LE(offset)
        offset += 2
        fnt.ft_flags = file.data.readUInt16LE(offset)
        offset += 2
        fnt.ft_baseline = file.data.readUInt16LE(offset)
        offset += 2
        fnt.ft_minchar = file.data.readUInt8(offset++)
        fnt.ft_maxchar = file.data.readUInt8(offset++)
        fnt.ft_bytewidth = file.data.readUInt16LE(offset)
        offset += 2
        fnt.ft_data = file.data.readUInt32LE(offset) + 8
        let data = file.data.subarray(fnt.ft_data)
        offset += 4
        fnt.ft_chars = file.data.readUInt32LE(offset)
        offset += 4
        fnt.ft_widths = file.data.readUInt32LE(offset) + 8
        let widths_data = file.data.subarray(fnt.ft_widths)
        offset += 4
        fnt.ft_kerndata = file.data.readUInt32LE(offset) + 8
        let kern_data = file.data.subarray(fnt.ft_kerndata)
        offset += 4

        fnt.widths = []
        if (fnt.ft_flags & FT_PROPORTIONAL) // Always the case
        {
            for (let i = 0; i < fnt.ft_maxchar - fnt.ft_minchar + 1; ++i)
            {
                fnt.widths.push(widths_data.readUInt16LE(i * 2))
            }
        }

        fnt.kerns = []
        if (fnt.ft_flags & FT_KERNED) // It seems to be always the case, even if it's empty
        {
            let kernOffset = 0
            let nextByte = kern_data.readUInt8(kernOffset++)
            while (nextByte != 0xFF)
            {
                fnt.kerns.push({
                    firstChar: nextByte,
                    secondChar: kern_data.readUInt8(kernOffset++),
                    newWidth: kern_data.readUInt8(kernOffset++)
                })
                nextByte = kern_data.readUInt8(kernOffset++)
            }
        }

        // Font definition file
        fs.writeFileSync(`./converted/fonts/${file.file_name}.json`, JSON.stringify(fnt, null, 2))

        // Font palette
        let palette = null;
        if (fnt.ft_flags & FT_COLOR)
        {
            let png = new PNG({width: 16, height: 16})
            let palOffset = file.data.length - 256 * 3

            for (let i = 0; i < 256; ++i)
            {
                png.data[i * 4 + 0] = file.data.readUInt8(palOffset + i * 3 + 0) * 4
                png.data[i * 4 + 1] = file.data.readUInt8(palOffset + i * 3 + 1) * 4
                png.data[i * 4 + 2] = file.data.readUInt8(palOffset + i * 3 + 2) * 4
                png.data[i * 4 + 3] = 255
            }

            png.data[255 * 4 + 3] = 0

            file.image_data = png.data
            
            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/fonts/${file.file_name}.256.png`, buffer)

            palette = file.image_data
        }

        // Font texture
        if (palette)
        {
            let texW = fnt.widths.reduce((total, w) => total + w, 0)
            let png = new PNG({width: texW, height: fnt.ft_h})
            let dataOffset = 0
            let xOffset = 0

            for (let c = fnt.ft_minchar; c <= fnt.ft_maxchar; ++c)
            {
                let cid = c - fnt.ft_minchar
                let w = fnt.widths[cid]
                for (let y = 0; y < fnt.ft_h; ++y)
                {
                    for (let x = 0; x < w; ++x)
                    {
                        let col = data.readUInt8(dataOffset++)
                        let k = y * texW + xOffset + x
                        png.data[k * 4 + 0] = palette[col * 4 + 0]
                        png.data[k * 4 + 1] = palette[col * 4 + 1]
                        png.data[k * 4 + 2] = palette[col * 4 + 2]
                        png.data[k * 4 + 3] = palette[col * 4 + 3]
                    }
                }
                xOffset += w
            }

            file.image_data = png.data
            
            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/fonts/${file.file_name}.png`, buffer)
        }
        else
        {
            let texW = fnt.widths.reduce((total, w) => total + w, 0)
            let png = new PNG({width: texW, height: fnt.ft_h})
            let dataOffset = 0
            let xOffset = 0
            let byte = 0
            let bit = 0

            for (let c = fnt.ft_minchar; c <= fnt.ft_maxchar; ++c)
            {
                let cid = c - fnt.ft_minchar
                let w = fnt.widths[cid]
                for (let y = 0; y < fnt.ft_h; ++y)
                {
                    for (let x = 0; x < w; ++x)
                    {
                        if (bit == 0)
                        {
                            byte = data.readUInt8(dataOffset++)
                        }
                        let col = byte & (0x80 >> bit)
                        bit = (bit + 1) % 8
                        let k = y * texW + xOffset + x
                        if (col)
                        {
                            png.data[k * 4 + 0] = 255
                            png.data[k * 4 + 1] = 255
                            png.data[k * 4 + 2] = 255
                            png.data[k * 4 + 3] = 255
                        }
                        else
                        {
                            png.data[k * 4 + 0] = 0
                            png.data[k * 4 + 1] = 0
                            png.data[k * 4 + 2] = 0
                            png.data[k * 4 + 3] = 0
                        }
                    }
                    bit = 0
                }
                xOffset += w
            }

            file.image_data = png.data
            
            let buffer = PNG.sync.write(png)
            fs.writeFileSync(`./converted/fonts/${file.file_name}.png`, buffer)
        }
    })
}

if (output_sounds)
{
    sounds.filter(file =>
    {
        console.log(`converting ${file.name}`)

        let offset = 0
        file.nSamples = file.data_length * 2
        let out_data = Buffer.alloc(44 + file.nSamples)

        out_data.writeUInt8('R'.charCodeAt(0), offset++) // ChunkID
        out_data.writeUInt8('I'.charCodeAt(0), offset++)
        out_data.writeUInt8('F'.charCodeAt(0), offset++)
        out_data.writeUInt8('F'.charCodeAt(0), offset++)
        out_data.writeUInt32LE(36 + file.nSamples, offset) // ChunkSize
        offset += 4
        out_data.writeUInt8('W'.charCodeAt(0), offset++) // Format
        out_data.writeUInt8('A'.charCodeAt(0), offset++)
        out_data.writeUInt8('V'.charCodeAt(0), offset++)
        out_data.writeUInt8('E'.charCodeAt(0), offset++)
        out_data.writeUInt8('f'.charCodeAt(0), offset++) // Subchunk1ID
        out_data.writeUInt8('m'.charCodeAt(0), offset++)
        out_data.writeUInt8('t'.charCodeAt(0), offset++)
        out_data.writeUInt8(' '.charCodeAt(0), offset++)
        out_data.writeUInt32LE(16, offset) // Subchunk1Size
        offset += 4
        out_data.writeUInt16LE(1, offset) // AudioFormat
        offset += 2
        out_data.writeUInt16LE(1, offset) // NumChannels
        offset += 2
        out_data.writeUInt32LE(11025, offset) // SampleRate
        offset += 4
        out_data.writeUInt32LE(11025, offset) // ByteRate
        offset += 4
        out_data.writeUInt16LE(1, offset) // BlockAlign
        offset += 2
        out_data.writeUInt16LE(8, offset) // BitsPerSample
        offset += 2
        out_data.writeUInt8('d'.charCodeAt(0), offset++) // Subchunk2ID
        out_data.writeUInt8('a'.charCodeAt(0), offset++)
        out_data.writeUInt8('t'.charCodeAt(0), offset++)
        out_data.writeUInt8('a'.charCodeAt(0), offset++)
        out_data.writeUInt32LE(file.nSamples, offset) // Subchunk2Size
        offset += 4
        for (let i = 0; i < file.data_length; ++i)
        {
            let sample = file.data.readUInt8(i)
            {
                let s = (sample & 0xF) * 16
                if (s < 128) s = 127 - s
                out_data.writeUInt8(s, offset++)
            }
            {
                let s = ((sample >> 4) & 0xF) * 16
                if (s < 128) s = 127 - s
                out_data.writeUInt8(s, offset++)
            }
        }

        fs.writeFileSync(`./converted/sounds/${file.name}.wav`, out_data)
    })
}

if (output_maps)
{
}

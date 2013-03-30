var Carambola = Carambola || {

};

Carambola.createFloatToRGBA8Shader = function(gpgpu_context, config) {
    var gl = gpgpu_context.gl;

    var fragment_shader_source = [""
        ,"    #ifdef GL_ES"
        ,"    precision highp float;"
        ,"    #endif"
        ,""
        ,"    varying vec2 v_tex_coord;"
        ,""
        ,"    uniform sampler2D u_tex_float;"
        ,""
        ,"    uniform float u_min_value;"
        ,"    uniform float u_max_value;"
        ,""
        ,"    const vec4 bit_sh = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);"
        ,"    const vec4 bit_mask = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);"
        ,""
        ,"    vec4 pack(in float value, in float min, in float max) {"
        ,"        value = (value - min) / (max - min);"
        ,"        vec4 result = fract(value * bit_sh);"
        ,"        result -= result.xxyz * bit_mask;"
        ,""
        ,"        return result;"
        ,"    }"
        ,""
        ,"    void main(void) {"
        ,"        vec4 data_vec = texture2D(u_tex_float, v_tex_coord);"
        ,"        float value = data_vec[ELEMENT];"
        ,"        gl_FragColor = pack(value, u_min_value, u_max_value);"
        ,"    }"
    ].join("\n");

    var fs_shader_defines = [
        {name: "ELEMENT", value: config.element_index}
    ];

    var program = Carambola.assembleGPGPUProgram(gpgpu_context, fragment_shader_source, fs_shader_defines);

    var uniforms = {
        float_texture: gl.getUniformLocation(program, "u_tex_float"),
        min_value: gl.getUniformLocation(program, "u_min_value"),
        max_value: gl.getUniformLocation(program, "u_max_value")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gl = gpgpu_context.gl;

    obj.input_textures = {
        float_texture: 0
    };

    obj.input_values = {
        min_value: 0,
        max_value: 0
    };

    obj.outputs = {
        int_texture: 0
    };

    obj.uniforms = uniforms;

    obj.execute = function(target_fbo_size) {
        gl.viewport(0, 0, target_fbo_size, target_fbo_size);
        gl.useProgram(program);

        gl.uniform1i(uniforms.float_texture, this.input_textures.float_texture);
        gl.uniform1f(uniforms.min_value, this.input_values.min_value);
        gl.uniform1f(uniforms.max_value, this.input_values.max_value);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputs.int_texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();
    };

    return obj;
};

Carambola.createPackFloatProgram = function(gpgpu_context) {
    // 0 1 2 3
    // -------
    // x y z w
    // r g b a
    var shaders = [];
    shaders.push(Carambola.createFloatToRGBA8Shader(gpgpu_context, {element_index: '0'}));
    shaders.push(Carambola.createFloatToRGBA8Shader(gpgpu_context, {element_index: '1'}));
    shaders.push(Carambola.createFloatToRGBA8Shader(gpgpu_context, {element_index: '2'}));
    shaders.push(Carambola.createFloatToRGBA8Shader(gpgpu_context, {element_index: '3'}));

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.shaders = shaders;

    obj.set_input_texture = function(texture_name, texture) {
        if (this.input_texture_objects.hasOwnProperty(texture_name)) {
            this.input_texture_objects[texture_name] = texture;
        }
        else {
            console.log("ERROR: Unrecognized input \'" + texture_name + "\'");
        }
    };

    obj.set_output = function(output_name, target) {
        if (this.output_framebuffer_objects.hasOwnProperty(output_name)) {
            this.output_framebuffer_objects[output_name] = target;
        }
        else {
            console.log("ERROR: Unrecognized output \'" + output_name + "\'");
        }
    };

    obj.input_texture_objects = {
        float_texture: {}
    };

    obj.input_values = {
        min_value: 0,
        max_value: 0,
        element_index: 0
    };

    obj.output_framebuffer_objects = {
        int_texture: {}
    };

    obj.arrays = {

    };

    obj.execute = function(target_fbo_size) {
        var p = this.shaders[this.input_values.element_index];

        p.set_input_texture("float_texture", this.input_texture_objects.float_texture);
        p.set_input_value("min_value", this.input_values.min_value);
        p.set_input_value("max_value", this.input_values.max_value);
        p.set_output("int_texture", this.output_framebuffer_objects.int_texture);

        p.execute(target_fbo_size);
    };

    return obj;
};

Carambola.createArrangeShader = function(gpgpu_context, config) {
    var gl = gpgpu_context.gl;

    var fragment_shader_source = [""
        ,"    #ifdef GL_ES"
        ,"    precision highp float;"
        ,"    #endif"
        ,""
        ,"    varying vec2 v_tex_coord;"
        ,""
        ,"    uniform sampler2D u_in_texture;"
        ,""
        ,"    void main(void) {"
        ,"        vec4 data_vec = texture2D(u_in_texture, v_tex_coord);"
        ,"        vec4 result = OPERATION"
        ,"        gl_FragColor = result;"
        ,"    }"
    ].join("\n");

    var keys = ['x', 'y', 'z', 'w'];
    var vector_accessor = keys[config.elements[0]] + keys[config.elements[1]] + keys[config.elements[2]] + keys[config.elements[3]];
    var fs_shader_defines = [
        {name: "OPERATION", value: 'data_vec.' + vector_accessor + ';'}
    ];

    var program = Carambola.assembleGPGPUProgram(gpgpu_context, fragment_shader_source, fs_shader_defines);

    var uniforms = {
        in_texture: gl.getUniformLocation(program, "u_in_texture")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gl = gpgpu_context.gl;

    obj.input_textures = {
        in_texture: 0
    };

    obj.input_values = {

    };

    obj.outputs = {
        out_texture: 0
    };

    obj.uniforms = uniforms;

    obj.execute = function(target_fbo_size) {
        gl.viewport(0, 0, target_fbo_size, target_fbo_size);
        gl.useProgram(program);

        gl.uniform1i(uniforms.in_texture, this.input_textures.in_texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputs.out_texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();
    };

    return obj;
};

Carambola.createPixelReadProgram = function(gpgpu_context) {
    var gl = gpgpu_context.gl;
    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gl = gpgpu_context.gl;

    obj.input_textures = {

    };

    obj.outputs = {

    };

    obj.arrays = {

    };

    obj.execute = function(source_fbo, width, height, target_array) {
        //var pix = new Uint8Array(width * height * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, source_fbo);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, target_array);
        //obj.arrays.uint8_data = pix;
    };

    return obj;
};
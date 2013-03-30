/*
**    Copyright (C) 2003-2013 Institute for Systems Biology
**                            Seattle, Washington, USA.
**
**    This library is free software; you can redistribute it and/or
**    modify it under the terms of the GNU Lesser General Public
**    License as published by the Free Software Foundation; either
**    version 2.1 of the License, or (at your option) any later version.
**
**    This library is distributed in the hope that it will be useful,
**    but WITHOUT ANY WARRANTY; without even the implied warranty of
**    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
**    Lesser General Public License for more details.
**
**    You should have received a copy of the GNU Lesser General Public
**    License along with this library; if not, write to the Free Software
**    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

var Carambola = Carambola || {

};

Carambola.GPGPUContext = {
    shader_attributes: {
        render_vertex_positions: 0,
        render_texture_coordinates: 1
    },

    init: function(element) {
        var canvas = element;
        this.try_gl_init(canvas);

        if (!this.gl) {
            console.log("WebGL not supported.");
            return;
        }

        this.init_vertex_arrays();
    },

    try_gl_init: function(canvas) {
        try {
            this.gl = canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
            this.gl.viewportWidth = canvas.width;
            this.gl.viewportHeight = canvas.height;

            // Enable floating point textures
            this.gl.getExtension("OES_texture_float");

            //this.glext_ft = this.gl.getExtension("GLI_frame_terminator");
        }
        catch (e) { }
    },
    get_render_vertex_position_attrib: function() {
        return this.shader_attributes.render_vertex_positions;
    },

    get_render_texture_coordinate_attrib: function() {
        return this.shader_attributes.render_texture_coordinates;
    },

    init_vertex_arrays: function() {
        var gl = this.gl;

        this.gpgpu_render_vao = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gpgpu_render_vao);
        var vertex_data = new Float32Array([-1,-1,0,0, -1,1,0,1, 1,-1,1,0, 1,1,1,1 ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);
    }
};

Carambola.gpgpu_program_methods = {
    set_input_texture: function(texture_name, texture) {
        if (this.input_textures.hasOwnProperty(texture_name)) {
            this.input_textures[texture_name] = texture.unit;
        }
        else {
            console.log("ERROR: Unrecognized input \'" + texture_name + "\'");
        }
    },

    set_input_value: function(value_name, value) {
        if (this.input_values.hasOwnProperty(value_name)) {
            this.input_values[value_name] = value;
        }
        else {
            console.log("ERROR: Unrecognized value \'" + value_name + "\'");
        }
    },

    set_output: function(output_name, target) {
        if (this.outputs.hasOwnProperty(output_name)) {
            this.outputs[output_name] = target.fbo;
        }
        else {
            console.log("ERROR: Unrecognized output \'" + output_name + "\'");
        }
    },

    bind_vertex_buffer: function() {
        var gpgpu_context = this.gpgpu_context;
        var gl = gpgpu_context.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, gpgpu_context.gpgpu_render_vao);

        gl.vertexAttribPointer(gpgpu_context.get_render_vertex_position_attrib(), 2, gl.FLOAT, gl.FALSE, 16, 0);
        gl.vertexAttribPointer(gpgpu_context.get_render_texture_coordinate_attrib(), 2, gl.FLOAT, gl.FALSE, 16, 2 * 4);

        gl.enableVertexAttribArray(gpgpu_context.get_render_vertex_position_attrib());
        gl.enableVertexAttribArray(gpgpu_context.get_render_texture_coordinate_attrib());
    },

    disable_vertex_buffer: function() {
        var gpgpu_context = this.gpgpu_context;
        var gl = gpgpu_context.gl;

        gl.disableVertexAttribArray(gpgpu_context.get_render_vertex_position_attrib());
        gl.disableVertexAttribArray(gpgpu_context.get_render_texture_coordinate_attrib());
    }
};

Carambola.assembleGPGPUProgram = function(gpgpu_context, fragment_shader_source, fragment_shader_defines) {
    var vertex_shader_source = [""
        ,"attribute vec2 a_pos;"
        ,"attribute vec2 a_tex_coord;"

        ,"varying vec2 v_tex_coord;"

        ,"void main(void) {"
        ,"    gl_Position = vec4(a_pos, 0., 1.);"
        ,"    v_tex_coord = a_tex_coord;"
        ,"}"
    ].join("\n");

    var gl = gpgpu_context.gl;

    var build_shader = function(p_source, defines, shadertype) {
        var source;

        source = "";
        defines = typeof(defines) != 'undefined' ? defines : [];

        for (var i = 0; i < defines.length; i++) {
            source += "#define " + defines[i].name + " " + defines[i].value + "\n";
        }

        source += p_source;
        var shader = gl.createShader(shadertype);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    };

    var assemble_program = function() {
        var vertex_shader,
            fragment_shader,
            shader_program;

        shader_program = gl.createProgram();
        vertex_shader = build_shader(vertex_shader_source, {}, gl.VERTEX_SHADER);
        fragment_shader = build_shader(fragment_shader_source, fragment_shader_defines, gl.FRAGMENT_SHADER);

        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);

        gl.bindAttribLocation(shader_program, gpgpu_context.get_render_vertex_position_attrib(), "a_pos");
        gl.bindAttribLocation(shader_program, gpgpu_context.get_render_texture_coordinate_attrib(), "a_tex_coord");
        gl.linkProgram(shader_program);

        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.log("Shader program assembly failed:");
            console.log(gl.getProgramInfoLog(shader_program));
        }

        return shader_program;
    };

    var program = assemble_program();

    return program;
};

Carambola.createForceAccumulator = function(gpgpu_context, p_node_mat_size) {
    var gl = gpgpu_context.gl;

    var fragment_shader_source = [""
        ,"    #ifdef GL_ES"
        ,"    precision highp float;"
        ,"    #endif"
        ,""
        ,"    // Coordinate in node texture"
        ,"    // sqrt(n) * sqrt(n)"
        ,"    varying vec2 v_tex_coord;"
        ,""
        ,"    uniform sampler2D u_spring_matrix;"
        ,"    uniform sampler2D u_node_pos;"
        ,"    uniform sampler2D u_node_prop;"
        ,""
        ,"    uniform float spring_damping;"
        ,"    uniform float u_spring_length_coeff;"
        ,"    uniform float u_spring_strength_coeff;"
        ,"    uniform float drag;"
        ,""
        ,"    uniform float u_coulomb_coeff;"
        ,"    uniform float u_centroid_coeff;"
        ,""
        ,"    const vec2 u_gravity_vec = vec2(0., 0.);"
        ,""
        ,"    const float MIN_DISTANCE = 0.00001;"
        ,"    const float ATTR_STRENGTH = -1000.0;"
        ,""
        ,"    const float node_mat_d = 1./SIZE;"
        ,"    const float conn_mat_d = 1./NUM_NODES;"
        ,"    // const float fix_constant = 0.0;"
        ,"    const float fix_constant = conn_mat_d / 2.0;"
        ,"    const float node_mat_fix = node_mat_d / 2.0;"
        ,""
        ,"    const float CONV_CONST_2D_TO_1D = 0.5 / SIZE;"
        ,""
        ,"    float addr2Dto1D(vec2 address2D) {"
        ,"        return (address2D.x / SIZE + address2D.y - CONV_CONST_2D_TO_1D);"
        ,"    }"
        ,""
        ,"    //const vec2 CONV_CONST_1D_TO_2D = NUM_NODES * vec2( 1.0 / SIZE, 1.0 / NUM_NODES );"
        ,"    const vec2 CONV_CONST_1D_TO_2D = NUM_NODES * vec2( 1.0 / SIZE, 1.0 / NUM_NODES );"
        ,""
        ,"    vec2 addr1Dto2D(float address1D)"
        ,"    {"
        ,"        vec2 normAddr2D = address1D * CONV_CONST_1D_TO_2D;"
        ,"        return vec2(fract(normAddr2D.x), normAddr2D.y);"
        ,"        // return vec2(fract(normAddr2D.x) + fix_constant, normAddr2D.y + fix_constant);"
        ,"    }"
        ,""
        ,"    vec2 compute_spring_force(vec2 pos_i, vec2 vel_i,"
        ,"                              vec2 pos_j, vec2 vel_j,"
        ,"                              float strength, float length, float damping) {"
        ,""
        ,"        vec2 dir = pos_i - pos_j;"
        ,"        float dist_squared = dir.x*dir.x + dir.y*dir.y;"
        ,"        float islink = min(step(MIN_DISTANCE, dist_squared), step(0.0000001, strength));"
        ,""
        ,"        float d = sqrt(dist_squared);"
        ,""
        ,"        dir = dir / (d+(1.0 - islink));"
        ,""
        ,"        float f = -(d - length) * strength;"
        ,"        vec2 v = vel_i - vel_j;"
        ,""
        ,"        float damp = -damping * dot(dir, v);"
        ,""
        ,"        return dir * (f + damp) * islink;"
        ,"    }"
        ,""
        ,"    // x, y - Coulomb force"
        ,"    // z, w - Centroid correction force"
        ,"    vec4 compute_coulomb(vec2 this_pos, float this_mass) {"
        ,"        vec2 coulomb_force = vec2(0.);"
        ,"        vec2 centrd = vec2(0.);"
        ,"        float centroid_cnt = 0.0;"
        ,""
        ,"        for (float yi = node_mat_d/2.0; yi < 1.; yi += node_mat_d ) {"
        ,"            for (float xi = node_mat_d/2.0; xi < 1.; xi += node_mat_d ) {"
        ,"                float id = max(abs(yi-v_tex_coord.y), abs(xi-v_tex_coord.x));"
        ,"                vec2 other_pos = texture2D(u_node_pos, vec2(xi, yi)).xy;"
        ,"                float other_mass = texture2D(u_node_prop, vec2(xi, yi)).x;"
        ,"                float is_positive_mass = step(0.0001, other_mass);"
        ,"                centrd += other_pos * is_positive_mass;"
        ,"                centroid_cnt += is_positive_mass;"
        ,""
        ,"                vec2 dv = this_pos - other_pos;"
        ,""
        ,"                float dsqr = dv.x*dv.x + dv.y*dv.y + step(id, 0.0001);"
        ,"                float nonzero = step(MIN_DISTANCE, dsqr);"
        ,""
        ,"                float dn = 1.0 / sqrt(dsqr + (1.0-nonzero));"
        ,""
        ,"                float fs = ATTR_STRENGTH * this_mass * other_mass / (dsqr + (1.0-nonzero));"
        ,"                vec2 force =  fs * dv * dn * step(0.0001, id) * nonzero;"
        ,""
        ,"                coulomb_force -= force;"
        ,"            }"
        ,"        }"
        ,""
        ,"        //vec2 centroid_drift = centrd / -NUM_NODES;"
        ,"        vec2 centroid_drift = centrd / -centroid_cnt;"
        ,""
        ,"        return vec4(coulomb_force, centroid_drift);"
        ,"    }"
        ,""
        ,"    void main(void) {"
        ,"        // Position in the connection matrix"
        ,"        float link_index = addr2Dto1D(v_tex_coord);"
        ,""
        ,"        // Get position and velocity vectors"
        ,"        vec4 node_data = texture2D(u_node_pos, v_tex_coord);"
        ,"        vec2 this_pos = node_data.xy;"
        ,"        vec2 this_vel = node_data.zw;"
        ,""
        ,"        // Mass and link index"
        ,"        vec3 node_prop = texture2D(u_node_prop, v_tex_coord).xyz;"
        ,"        float this_mass = node_prop.x;"
        ,""
        ,"        // Position in the connection matrix"
        ,"        //float link_index = node_prop.z;"
        ,""
        ,"        vec2 this_force = vec2(0.);"
        ,""
        ,"        // Accumulate spring force"
        ,"        vec2 spring_force = vec2(0., 0.);"
        ,"        for (float j = 0.; j < 1.; j += conn_mat_d) {"
        ,"            // Current node as source"
        ,"            vec4 spring = texture2D(u_spring_matrix, vec2(j, link_index));"
        ,"            float strength = u_spring_strength_coeff * spring.x;"
        ,"            float length = u_spring_length_coeff * spring.y;"
        ,""
        ,"            vec4 dst_data = texture2D(u_node_pos, addr1Dto2D(j));"
        ,"            vec2 foo = addr1Dto2D(j);"
        ,"            vec2 dst_pos = dst_data.xy;"
        ,"            vec2 dst_vel = dst_data.zw;"
        ,""
        ,"            vec2 sf = compute_spring_force(this_pos, this_vel, dst_pos, dst_vel, strength, length, spring_damping);"
        ,"            spring_force += sf;"
        ,"        }"
        ,""
        ,"        // Attractive forces"
        ,"        vec4 coulomb_and_centroid = compute_coulomb(this_pos, this_mass);"
        ,"        vec2 coulomb_force = u_coulomb_coeff * coulomb_and_centroid.xy;"
        ,"        vec2 centroid_drift = u_centroid_coeff * coulomb_and_centroid.zw;"
        ,""
        ,"        // Apply drag"
        ,"        this_force = this_force - this_vel * drag;"
        ,""
        ,"        this_force = this_force + spring_force + coulomb_force + centroid_drift;"
        ,"        //this_force = this_force + spring_force + coulomb_force;"
        ,""
        ,"        gl_FragColor = vec4(this_force, this_vel);"
        ,"    }"
    ].join("\n");

    var fs_shader_defines = [
        {name: "SIZE", value: p_node_mat_size.toFixed(1)},
        {name: "NUM_NODES", value: (p_node_mat_size * p_node_mat_size).toFixed(1)}
    ];

    var program = Carambola.assembleGPGPUProgram(gpgpu_context, fragment_shader_source, fs_shader_defines);

    var uniforms = {
        node_properties: gl.getUniformLocation(program, "u_node_prop"),
        node_positions: gl.getUniformLocation(program, "u_node_pos"),
        spring_matrix: gl.getUniformLocation(program, "u_spring_matrix"),
        spring_damping: gl.getUniformLocation(program, "spring_damping"),
        spring_length_coeff: gl.getUniformLocation(program, "u_spring_length_coeff"),
        spring_strength_coeff: gl.getUniformLocation(program, "u_spring_strength_coeff"),
        drag: gl.getUniformLocation(program, "drag"),
        coulomb_coeff: gl.getUniformLocation(program, "u_coulomb_coeff"),
        centroid_coeff: gl.getUniformLocation(program, "u_centroid_coeff")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gpgpu_context = gpgpu_context;
    //obj.gl = gpgpu_context.gl;

    obj.input_textures = {
        node_positions: 0,
        node_properties: 0,
        spring_matrix: 0
    };

    obj.input_values = {
        spring_damping: 0,
        drag: 0,
        spring_length_coeff: 1.0,
        spring_strength_coeff: 1.0,
        coulomb_coeff: 1.0,
        centroid_coeff: 1.0
    };

    obj.outputs = {
        force_and_velocity: 0
    };

    obj.uniforms = uniforms;

    obj.execute = function(target_fbo_size) {
        var gl = this.gpgpu_context.gl;

        gl.viewport(0, 0, target_fbo_size, target_fbo_size);
        gl.useProgram(program);

        this.bind_vertex_buffer();

        gl.uniform1i(uniforms.node_positions, this.input_textures.node_positions);
        gl.uniform1i(uniforms.node_properties, this.input_textures.node_properties);
        gl.uniform1i(uniforms.spring_matrix, this.input_textures.spring_matrix);
        gl.uniform1f(uniforms.spring_damping, this.input_values.spring_damping);
        gl.uniform1f(uniforms.spring_length_coeff, this.input_values.spring_length_coeff);
        gl.uniform1f(uniforms.spring_strength_coeff, this.input_values.spring_strength_coeff);
        gl.uniform1f(uniforms.drag, this.input_values.drag);
        gl.uniform1f(uniforms.coulomb_coeff, this.input_values.coulomb_coeff);
        gl.uniform1f(uniforms.centroid_coeff, this.input_values.centroid_coeff);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputs.force_and_velocity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.disable_vertex_buffer();

        gl.flush();
    };

    return obj;
};

Carambola.createRK4Derivative = function(gpgpu_context) {
    var gl = gpgpu_context.gl;

    var fragment_shader_source = [""
        ,"#ifdef GL_ES"
        ,"precision highp float;"
        ,"#endif"

        ,"// Coordinate in node texture"
        ,"// sqrt(n) * sqrt(n)"
        ,"varying vec2 v_tex_coord;"

        ,"uniform sampler2D u_rk_vel_force;"
        ,"uniform sampler2D u_node_prop;"
        ,"uniform sampler2D u_node_orig_pos;"

        ,"uniform float timestep;"
        ,"uniform float multiplier;"

        ,"void main(void) {"
        ,"    vec4 p0 = texture2D(u_node_orig_pos, v_tex_coord);"
        ,"    vec2 orig_pos = p0.xy;"
        ,"    vec2 orig_vel = p0.zw;"
        ,"    float this_mass = texture2D(u_node_prop, v_tex_coord).x;"
        ,"    float nonzero = step(0.0001, this_mass);"

        ,"    vec4 k1_result = texture2D(u_rk_vel_force, v_tex_coord);"
        ,"    vec2 k1_force = k1_result.xy;"
        ,"    vec2 k1_vel = k1_result.zw;"

        ,"    vec2 k2_pos = orig_pos + k1_vel * multiplier * timestep;"
        ,"    vec2 k2_vel = orig_vel + (k1_force * multiplier * timestep) / (this_mass + (1.0 - nonzero));"

        ,"    gl_FragColor = vec4(k2_pos, k2_vel * nonzero);"
        ,"}"
    ].join("\n");

    var program = Carambola.assembleGPGPUProgram(gpgpu_context, fragment_shader_source, {});

    var uniforms = {
        node_properties: gl.getUniformLocation(program, "u_node_prop"),
        node_positions: gl.getUniformLocation(program, "u_node_orig_pos"),
        node_force_and_velocity: gl.getUniformLocation(program, "u_rk_vel_force"),
        timestep: gl.getUniformLocation(program, "timestep"),
        multiplier: gl.getUniformLocation(program, "multiplier")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gpgpu_context = gpgpu_context;
    //obj.gl = gpgpu_context.gl;

    obj.program = program;

    obj.input_textures = {
        node_positions: 0,
        node_properties: 0,
        node_force_and_velocity: 0
    };

    obj.input_values = {
        multiplier: 0,
        timestep: 0
    };

    obj.outputs = {
        position_and_velocity: 0
    };

    obj.uniforms = uniforms;

    obj.execute = function(target_fbo_size) {
        var gl = this.gpgpu_context.gl;

        gl.viewport(0, 0, target_fbo_size, target_fbo_size);
        gl.useProgram(this.program);

        this.bind_vertex_buffer();

        gl.uniform1i(this.uniforms.node_positions, this.input_textures.node_positions);
        gl.uniform1i(this.uniforms.node_properties, this.input_textures.node_properties);
        gl.uniform1i(this.uniforms.node_force_and_velocity, this.input_textures.node_force_and_velocity);
        gl.uniform1f(this.uniforms.timestep, this.input_values.timestep);
        gl.uniform1f(this.uniforms.multiplier, this.input_values.multiplier);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputs.position_and_velocity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.disable_vertex_buffer();

        gl.flush();
    };

    return obj;
};

Carambola.createRK4Integrator = function(gpgpu_context) {
    var gl = gpgpu_context.gl;

    var fragment_shader_source = [""
        ,"    #ifdef GL_ES"
        ,"    precision highp float;"
        ,"    #endif"
        ,""
        ,"    // Coordinate in node texture"
        ,"    // sqrt(n) * sqrt(n)"
        ,"    varying vec2 v_tex_coord;"
        ,""
        ,"    uniform sampler2D u_k1_force_vel;"
        ,"    uniform sampler2D u_k2_force_vel;"
        ,"    uniform sampler2D u_k3_force_vel;"
        ,"    uniform sampler2D u_k4_force_vel;"
        ,""
        ,"    uniform sampler2D u_node_prop;"
        ,"    uniform sampler2D u_node_orig_pos;"
        ,""
        ,"    uniform float timestep;"
        ,""
        ,"    void main(void) {"
        ,"        vec4 p0 = texture2D(u_node_orig_pos, v_tex_coord);"
        ,"        vec2 orig_pos = p0.xy;"
        ,"        vec2 orig_vel = p0.zw;"
        ,"        float this_mass = texture2D(u_node_prop, v_tex_coord).x;"
        ,"        float nonzero = step(0.0001, this_mass);"
        ,""
        ,"        vec4 k1_result = texture2D(u_k1_force_vel, v_tex_coord);"
        ,"        vec2 k1_force = k1_result.xy;"
        ,"        vec2 k1_vel = k1_result.zw;"
        ,""
        ,"        vec4 k2_result = texture2D(u_k2_force_vel, v_tex_coord);"
        ,"        vec2 k2_force = k2_result.xy;"
        ,"        vec2 k2_vel = k2_result.zw;"
        ,""
        ,"        vec4 k3_result = texture2D(u_k3_force_vel, v_tex_coord);"
        ,"        vec2 k3_force = k3_result.xy;"
        ,"        vec2 k3_vel = k3_result.zw;"
        ,""
        ,"        vec4 k4_result = texture2D(u_k4_force_vel, v_tex_coord);"
        ,"        vec2 k4_force = k4_result.xy;"
        ,"        vec2 k4_vel = k4_result.zw;"
        ,""
        ,"        vec2 pos = orig_pos + timestep / 6.0 * (k1_vel + 2.0 * k2_vel + 2.0 * k3_vel + k4_vel);"
        ,"        vec2 vel = orig_vel + timestep / (6.0 * (this_mass + (1.0 - nonzero))) * (k1_force + 2.0 * k2_force + 2.0 * k3_force + k4_force);"
        ,""
        ,"        gl_FragColor = vec4(pos, vel * nonzero);"
        ,"    }"
    ].join("\n");

    var program = Carambola.assembleGPGPUProgram(gpgpu_context, fragment_shader_source, {});

    var uniforms = {
        node_properties: gl.getUniformLocation(program, "u_node_prop"),
        node_positions: gl.getUniformLocation(program, "u_node_orig_pos"),
        k1_force_and_vel: gl.getUniformLocation(program, "u_k1_force_vel"),
        k2_force_and_vel: gl.getUniformLocation(program, "u_k2_force_vel"),
        k3_force_and_vel: gl.getUniformLocation(program, "u_k3_force_vel"),
        k4_force_and_vel: gl.getUniformLocation(program, "u_k4_force_vel"),
        timestep: gl.getUniformLocation(program, "timestep")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});

    obj.gpgpu_context = gpgpu_context;

    obj.program = program;

    obj.input_textures = {
        node_positions: 0,
        node_properties: 0,
        k1_force_and_vel: 0,
        k2_force_and_vel: 0,
        k3_force_and_vel: 0,
        k4_force_and_vel: 0
    };

    obj.input_values = {
        timestep: 0
    };

    obj.outputs = {
        position_and_velocity: 0
    };

    obj.uniforms = uniforms;

    obj.execute = function(target_fbo_size) {
        var gl = this.gpgpu_context.gl;

        gl.viewport(0, 0, target_fbo_size, target_fbo_size);
        gl.useProgram(this.program);

        this.bind_vertex_buffer();

        gl.uniform1i(this.uniforms.node_positions, this.input_textures.node_positions);
        gl.uniform1i(this.uniforms.node_properties, this.input_textures.node_properties);
        gl.uniform1i(this.uniforms.k1_force_and_vel, this.input_textures.k1_force_and_vel);
        gl.uniform1i(this.uniforms.k2_force_and_vel, this.input_textures.k2_force_and_vel);
        gl.uniform1i(this.uniforms.k3_force_and_vel, this.input_textures.k3_force_and_vel);
        gl.uniform1i(this.uniforms.k4_force_and_vel, this.input_textures.k4_force_and_vel);
        gl.uniform1f(this.uniforms.timestep, this.input_values.timestep);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputs.position_and_velocity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.disable_vertex_buffer();

        gl.flush();
    };

    return obj;
};

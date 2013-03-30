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

Carambola.createOldRenderer = function(gpgpu_context, node_list, edge_list, node_matrix_size) {
    var gl = gpgpu_context.gl;

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    var vertex_shader_source = [""
        ,"attribute vec2 a_coord;"
        ,"attribute vec3 a_color;"
        ,""
        ,"uniform sampler2D u_node_pos;"
        ,"uniform vec3 u_camera_loc;"
        ,"uniform float u_camera_scale;"
        ,""
        ,"varying vec4 color;"
        ,""
        ,"void main(void) {"
        ,"    mat4 cam_trans = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, 0.0,"
        ,"                           u_camera_loc.x, u_camera_loc.y, u_camera_loc.z, 1.0 );"
        ,""
        ,"    mat4 cam_scale = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, u_camera_scale,"
        ,"                           0.0, 0.0, 0.0, 1.0 );"
        ,""
        ,"    vec2 pos = texture2D(u_node_pos, a_coord).xy;"
        ,""
        ,"    gl_Position = cam_scale * cam_trans * vec4(pos, 1.0, 1.0);"
        ,"    color = vec4( a_color, 1.0 );"
        ,"}"
    ].join("\n");

    var fragment_shader_source = [""
        ,"#ifdef GL_ES"
        ,"precision highp float;"
        ,"#endif"

        ," varying vec4 color;"

        ," void main() {"
        ,"    gl_FragColor = color;"
        ,"}"
    ].join("\n");

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

    var shader_attributes = {
        point_coordinate: 0,
        point_color: 1
    };

    var assemble_program = function(p_vertex_array, vs_shader_src, fs_shader_src) {
        var gl,
            vertex_shader,
            fragment_shader,
            shader_program;

        gl = gpgpu_context.gl;
        shader_program = gl.createProgram();
        vertex_shader = build_shader(vs_shader_src, {}, gl.VERTEX_SHADER);
        fragment_shader = build_shader(fs_shader_src, {}, gl.FRAGMENT_SHADER);

        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);

        gl.bindAttribLocation(shader_program, shader_attributes.point_coordinate, "a_coord");
        gl.bindAttribLocation(shader_program, shader_attributes.point_color, "a_color");

        gl.linkProgram(shader_program);

        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.log("Shader program assembly failed:");
            console.log(gl.getProgramInfoLog(shader_program));
        }

        gl.useProgram(shader_program);

        gl.bindBuffer(gl.ARRAY_BUFFER, p_vertex_array);

        gl.vertexAttribPointer(shader_attributes.point_coordinate, 2, gl.FLOAT, gl.FALSE, 5 * 4, 0);
        gl.vertexAttribPointer(shader_attributes.point_color, 3, gl.FLOAT, gl.FALSE, 5 * 4, 2 * 4);
        gl.enableVertexAttribArray(shader_attributes.point_coordinate);
        gl.enableVertexAttribArray(shader_attributes.point_color);

        return shader_program;
    };

    var init_vertex_arrays = function(node_list, edge_list, node_matrix_size) {
        var d,
            node_points,
            edge_points,
            index,
            cnt,
            render_points,
            node_points_offset,
            node_points_count,
            link_lines_offset,
            link_lines_count,
            graph_vertex_array;

        node_points = [];
        index = 0;
        node_points_offset = 0;
        cnt = 0;
        d = 1.0 / node_matrix_size;
        for (var y = d/2; y < 1; y+= d) {
            for (var x = d/2; x < 1; x+= d) {
                node_points.push( x );
                node_points.push( y );
                node_points.push(node_list[cnt].color[0]);
                node_points.push(node_list[cnt].color[1]);
                node_points.push(node_list[cnt].color[2]);
                index = index + 1;
                cnt = cnt + 1;

                if (cnt == node_list.length) {
                    break;
                }
            }

            if (cnt == node_list.length) {
                break;
            }
        }

        node_points_count = index;

        link_lines_offset = index;
        index = 0;

        edge_points = [];
        for (var i = 0; i < edge_list.length; i++) {
            var e = edge_list[i];
            var source = e.source;
            var x = node_points[5 * source];
            var y = node_points[5 * source + 1];
            edge_points.push(x, y);
            edge_points.push(e.color[0], e.color[1], e.color[2]);

            var target = e.target;
            x = node_points[5 * target];
            y = node_points[5 * target + 1];
            edge_points.push(x, y);
            edge_points.push(e.color[0], e.color[1], e.color[2]);
            index = index + 2;
        }

        link_lines_count = index;

        render_points = node_points.slice(0);
        render_points = render_points.concat(edge_points);

        graph_vertex_array = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, graph_vertex_array);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(render_points), gl.STATIC_DRAW);

        return {
            vertex_indices: {
                node_points_offset: node_points_offset,
                node_points_count: node_points_count,
                link_lines_offset: link_lines_offset,
                link_lines_count: link_lines_count
            },
            vertex_arrays: {
                graph: graph_vertex_array
            }
        };
    };

    var render_data = init_vertex_arrays(node_list, edge_list, node_matrix_size);

    var program = assemble_program(render_data.vertex_arrays.graph, vertex_shader_source, fragment_shader_source);

    var uniforms = {
        node_positions: gl.getUniformLocation(program, "u_node_pos"),
        camera_location: gl.getUniformLocation(program, "u_camera_loc"),
        camera_scale: gl.getUniformLocation(program, "u_camera_scale")
    };

    return {
        gl: gl,

        shader_attributes: {
            point_coodinate: 0,
            point_color: 1
        },

        input_textures: {
            node_positions: 0
        },

        uniforms: uniforms,

        vertex_arrays: render_data.vertex_arrays,
        vertex_indices: render_data.vertex_indices,

        camera_trans: {
            x: 0.0,
            y: 0.0
        },

        camera_scale: 128.00,
        move_step: 50.0,
        zoom_step: 50.0,

        execute: function(position_tex_unit, viewport_width, viewport_height) {
            gl.viewport(0, 0, viewport_width, viewport_height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.useProgram(program);

            gl.uniform1i(uniforms.node_positions, position_tex_unit);
            gl.uniform3f(uniforms.camera_location, this.camera_trans.x, this.camera_trans.y, 0.0);
            gl.uniform1f(uniforms.camera_scale, this.camera_scale);

            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.BLEND);

            gl.drawArrays(gl.LINES, render_data.vertex_indices.link_lines_offset, render_data.vertex_indices.link_lines_count);
            gl.drawArrays(gl.POINTS, render_data.vertex_indices.node_points_offset, render_data.vertex_indices.node_points_count);

            gl.disable(gl.BLEND);
            gl.flush();
        }
    };
};


Carambola.createCircleShader = function(gpgpu_context) {
    var vertex_shader_source = [""
        ,"attribute vec2 a_coord;"
        ,"attribute vec3 a_color;"
        ,"attribute float a_radius;"
        ,""
        ,"uniform sampler2D u_node_pos;"
        ,"uniform vec3 u_camera_loc;"
        ,"uniform float u_camera_scale;"
        ,""
        ,"varying vec4 v_color;"
        ,""
        ,"void main(void) {"
        ,"    mat4 cam_trans = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, 0.0,"
        ,"                           u_camera_loc.x, u_camera_loc.y, u_camera_loc.z, 1.0 );"
        ,""
        ,"    mat4 cam_scale = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, u_camera_scale,"
        ,"                           0.0, 0.0, 0.0, 1.0 );"
        ,""
        ,"    vec2 pos = texture2D(u_node_pos, a_coord).xy;"
        ,""
        ,"    gl_PointSize = a_radius;"
        ,"    gl_Position = cam_scale * cam_trans * vec4(pos, 1.0, 1.0);"
        ,"    v_color = vec4( a_color, 1.0 );"
        ,"}"
    ].join("\n");

    var fragment_shader_source = [""
        ,"#ifdef GL_ES"
        ,"precision highp float;"
        ,"#endif"
        ,""
        ," varying vec4 v_color;"
        ,""
        ," void main() {"
        ,"    vec2 coord = gl_PointCoord - vec2(0.5, 0.5);"
        ,"    float dsqr = coord.x*coord.x + coord.y*coord.y;"
        ,"    gl_FragColor = ( (0.5-dsqr) / 0.5) * v_color;"
        ,"}"
    ].join("\n");

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

    var shader_attributes = {
        point_coordinate: 0,
        point_color: 1,
        point_radius: 2
    };

    var assemble_program = function(vs_shader_src, fs_shader_src) {
        var gl,
            vertex_shader,
            fragment_shader,
            shader_program;

        gl = gpgpu_context.gl;
        shader_program = gl.createProgram();
        vertex_shader = build_shader(vs_shader_src, {}, gl.VERTEX_SHADER);
        fragment_shader = build_shader(fs_shader_src, {}, gl.FRAGMENT_SHADER);

        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);

        gl.bindAttribLocation(shader_program, shader_attributes.point_coordinate, "a_coord");
        gl.bindAttribLocation(shader_program, shader_attributes.point_color, "a_color");
        gl.bindAttribLocation(shader_program, shader_attributes.point_radius, "a_radius");

        gl.linkProgram(shader_program);

        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.log("Shader program assembly failed:");
            console.log(gl.getProgramInfoLog(shader_program));
        }

        return shader_program;
    };

    var gl = gpgpu_context.gl;
    var program = assemble_program(vertex_shader_source, fragment_shader_source);

    var uniforms = {
        node_positions: gl.getUniformLocation(program, "u_node_pos"),
        camera_location: gl.getUniformLocation(program, "u_camera_loc"),
        camera_scale: gl.getUniformLocation(program, "u_camera_scale")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});
    obj.gl = gpgpu_context.gl;

    obj.program = program;

    obj.shader_attributes = shader_attributes;

    obj.input_textures = {
        node_positions: 0
    };

    obj.uniforms = uniforms;

    obj.camera_trans = {
        x: 0.0,
        y: 0.0
    };

    obj.camera_scale = 128.00;

    obj.vertex_buffer = 0;
    obj.vertex_count = 0;

    obj.execute = function(position_tex_unit, render_data, viewport_width, viewport_height) {
        var gl = this.gl;

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, render_data.vertex_buffer);

        gl.vertexAttribPointer(this.shader_attributes.point_coordinate, 2, gl.FLOAT, gl.FALSE, 6 * 4, 0);
        gl.vertexAttribPointer(this.shader_attributes.point_color, 3, gl.FLOAT, gl.FALSE, 6 * 4, 2 * 4);
        gl.vertexAttribPointer(this.shader_attributes.point_radius, 1, gl.FLOAT, gl.FALSE, 6 * 4, 5 * 4);

        gl.enableVertexAttribArray(this.shader_attributes.point_coordinate);
        gl.enableVertexAttribArray(this.shader_attributes.point_color);
        gl.enableVertexAttribArray(this.shader_attributes.point_radius);

        gl.uniform1i(this.uniforms.node_positions, position_tex_unit);
        gl.uniform3f(this.uniforms.camera_location, this.camera_trans.x, this.camera_trans.y, 0.0);
        gl.uniform1f(this.uniforms.camera_scale, this.camera_scale);

        gl.drawArrays(gl.POINTS, 0, render_data.length);

        gl.disableVertexAttribArray(this.shader_attributes.point_coordinate);
        gl.disableVertexAttribArray(this.shader_attributes.point_color);
        gl.disableVertexAttribArray(this.shader_attributes.point_radius);
    };

    return obj;
};

Carambola.createLineShader = function(gpgpu_context) {
    var vertex_shader_source = [""
        ,"attribute vec2 a_coord;"
        ,"attribute vec3 a_color;"
        ,""
        ,"uniform sampler2D u_node_pos;"
        ,"uniform vec3 u_camera_loc;"
        ,"uniform float u_camera_scale;"
        ,""
        ,"varying vec4 color;"
        ,""
        ,"void main(void) {"
        ,"    mat4 cam_trans = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, 0.0,"
        ,"                           u_camera_loc.x, u_camera_loc.y, u_camera_loc.z, 1.0 );"
        ,""
        ,"    mat4 cam_scale = mat4( 1.0, 0.0, 0.0, 0.0,"
        ,"                           0.0, 1.0, 0.0, 0.0,"
        ,"                           0.0, 0.0, 1.0, u_camera_scale,"
        ,"                           0.0, 0.0, 0.0, 1.0 );"
        ,""
        ,"    vec2 pos = texture2D(u_node_pos, a_coord).xy;"
        ,""
        ,"    gl_Position = cam_scale * cam_trans * vec4(pos, 1.0, 1.0);"
        ,"    color = vec4( a_color, 1.0 );"
        ,"}"
    ].join("\n");

    var fragment_shader_source = [""
        ,"#ifdef GL_ES"
        ,"precision highp float;"
        ,"#endif"

        ," varying vec4 color;"

        ," void main() {"
        ,"    gl_FragColor = color;"
        ,"}"
    ].join("\n");

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

    var shader_attributes = {
        point_coordinate: 0,
        point_color: 1
    };

    var assemble_program = function(vs_shader_src, fs_shader_src) {
        var gl,
            vertex_shader,
            fragment_shader,
            shader_program;

        gl = gpgpu_context.gl;
        shader_program = gl.createProgram();
        vertex_shader = build_shader(vs_shader_src, {}, gl.VERTEX_SHADER);
        fragment_shader = build_shader(fs_shader_src, {}, gl.FRAGMENT_SHADER);

        gl.attachShader(shader_program, vertex_shader);
        gl.attachShader(shader_program, fragment_shader);

        gl.bindAttribLocation(shader_program, shader_attributes.point_coordinate, "a_coord");
        gl.bindAttribLocation(shader_program, shader_attributes.point_color, "a_color");

        gl.linkProgram(shader_program);

        if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
            console.log("Shader program assembly failed:");
            console.log(gl.getProgramInfoLog(shader_program));
        }

        return shader_program;
    };

    var gl = gpgpu_context.gl;
    var program = assemble_program(vertex_shader_source, fragment_shader_source);

    var uniforms = {
        node_positions: gl.getUniformLocation(program, "u_node_pos"),
        camera_location: gl.getUniformLocation(program, "u_camera_loc"),
        camera_scale: gl.getUniformLocation(program, "u_camera_scale")
    };

    var obj = Object.create(Carambola.gpgpu_program_methods, {});
    obj.gl = gpgpu_context.gl;

    obj.program = program;

    obj.shader_attributes = shader_attributes;

    obj.input_textures = {
        node_positions: 0
    };

    obj.uniforms = uniforms;

    obj.camera_trans = {
        x: 0.0,
        y: 0.0
    };

    obj.camera_scale = 128.00;

    obj.vertex_buffer = 0;
    obj.vertex_count = 0;

    obj.execute = function(position_tex_unit, render_data, viewport_width, viewport_height) {
        var gl = this.gl;

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, render_data.vertex_buffer);

        gl.vertexAttribPointer(this.shader_attributes.point_coordinate, 2, gl.FLOAT, gl.FALSE, 5 * 4, 0);
        gl.vertexAttribPointer(this.shader_attributes.point_color, 3, gl.FLOAT, gl.FALSE, 5 * 4, 2 * 4);

        gl.enableVertexAttribArray(shader_attributes.point_coordinate);
        gl.enableVertexAttribArray(shader_attributes.point_color);

        gl.uniform1i(this.uniforms.node_positions, position_tex_unit);
        gl.uniform3f(this.uniforms.camera_location, this.camera_trans.x, this.camera_trans.y, 0.0);
        gl.uniform1f(this.uniforms.camera_scale, this.camera_scale);

        gl.drawArrays(gl.LINES, 0, render_data.length);

        gl.disableVertexAttribArray(shader_attributes.point_coordinate);
        gl.disableVertexAttribArray(shader_attributes.point_color);
    };

    return obj;
};
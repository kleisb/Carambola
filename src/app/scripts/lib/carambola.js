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

Carambola.Visualization = {
    init: function(el_id) {
        var gpgpu_ctx;
        gpgpu_ctx = Object.create(Carambola.GPGPUContext, {});
        gpgpu_ctx.init(el_id);
    },

    execute_force_accumulator: function(position_texture, target_fbo) {
        var p = this.programs.force_accumulator;
        p.set_input_texture("node_positions", position_texture);
        p.set_input_texture("node_properties", this.static_textures.node_properties);
        p.set_input_texture("spring_matrix", this.static_textures.connection_matrix);
        p.set_input_value("drag", this.simulation.drag);
        p.set_input_value("spring_damping", this.simulation.spring_damping);
        p.set_input_value("spring_length_coeff", this.simulation.spring_length_coeff);
        p.set_input_value("spring_strength_coeff", this.simulation.spring_strength_coeff);
        p.set_input_value("coulomb_coeff", this.simulation.coulomb_coeff);
        p.set_input_value("centroid_coeff", this.simulation.centroid_coeff);
        p.set_output("force_and_velocity", target_fbo);
        p.execute(this.simulation.node_matrix_size);
    },

    execute_rk4_diff: function(multiplier, k1_texture, target_fbo) {
        var p = this.programs.rk4diff;
        p.set_input_texture("node_positions", this.framebuffers.pos_0);
        p.set_input_texture("node_properties", this.static_textures.node_properties);
        p.set_input_texture("node_force_and_velocity", k1_texture);
        p.set_input_value("multiplier", multiplier);
        p.set_input_value("timestep", this.simulation.timestep);
        p.set_output("position_and_velocity", target_fbo);
        p.execute(this.simulation.node_matrix_size);
    },

    execute_rk4_integrate: function(k1_texture, k2_texture, k3_texture, k4_texture, target_fbo) {
        var p = this.programs.rk4integrator;
        p.set_input_texture("node_positions", this.framebuffers.pos_0);
        p.set_input_texture("node_properties", this.static_textures.node_properties);
        p.set_input_texture("k1_force_and_vel", k1_texture);
        p.set_input_texture("k2_force_and_vel", k2_texture);
        p.set_input_texture("k3_force_and_vel", k3_texture);
        p.set_input_texture("k4_force_and_vel", k4_texture);
        p.set_input_value("timestep", this.simulation.timestep);
        p.set_output("position_and_velocity", target_fbo);
        p.execute(this.simulation.node_matrix_size);
    },

    tick_rk4_step1: function() {
        this.execute_force_accumulator(this.framebuffers.pos_0, this.framebuffers.rk4_k1_force_vel);
    },

    tick_rk4_step2: function() {
        this.execute_rk4_diff(0.5, this.framebuffers.rk4_k1_force_vel, this.framebuffers.pos_1);
        this.execute_force_accumulator(this.framebuffers.pos_1, this.framebuffers.rk4_k2_force_vel);
    },

    tick_rk4_step3: function() {
        this.execute_rk4_diff(0.5, this.framebuffers.rk4_k2_force_vel, this.framebuffers.pos_1);
        this.execute_force_accumulator(this.framebuffers.pos_1, this.framebuffers.rk4_k3_force_vel);
    },

    tick_rk4_step4: function() {
        this.execute_rk4_diff(1.0, this.framebuffers.rk4_k3_force_vel, this.framebuffers.pos_1);
        this.execute_force_accumulator(this.framebuffers.pos_1, this.framebuffers.rk4_k4_force_vel);
    },

    tick_rk4_integrate: function() {
        this.execute_rk4_integrate(
            this.framebuffers.rk4_k1_force_vel,
            this.framebuffers.rk4_k2_force_vel,
            this.framebuffers.rk4_k3_force_vel,
            this.framebuffers.rk4_k4_force_vel,
            this.framebuffers.pos_1);
    },

    tick: function() {
        this.tick_rk4_step1();
        this.tick_rk4_step2();
        this.tick_rk4_step3();
        this.tick_rk4_step4();
        this.tick_rk4_integrate();
    },

    handle_mouseenter: function(event) {
        this.state.mouse_over = true;
    },

    handle_mouseout: function(event) {
        this.state.mouse_over = false;
    },

    handle_mousedown: function(event) {
        this.state.mouse_down = true;
        this.state.last_mouse_x = event.clientX;
        this.state.last_mouse_y = event.clientY;
    },

    handle_mouseup: function() {
        this.state.mouse_down = false;
    },

    handle_mouse_move: function(event) {
        var mouse_x = event.clientX - this.canvas.offsetLeft;
        var mouse_y = event.clientY - this.canvas.offsetTop;

        if (this.mouse_over == true) {
            this.state.current_mouse_x = mouse_x;
            this.state.current_mouse_y = mouse_y;
        }

        if (this.state.mouse_down == true) {
            var delta_x = mouse_x - this.state.last_mouse_x;
            var delta_y = mouse_y - this.state.last_mouse_y;

            this.programs.circle_render.camera_trans.x += delta_x;
            this.programs.circle_render.camera_trans.y -= delta_y;
            this.programs.line_render.camera_trans.x += delta_x;
            this.programs.line_render.camera_trans.y -= delta_y;

            this.state.last_mouse_x = mouse_x;
            this.state.last_mouse_y = mouse_y;
        }
    },

    set_mouse_handlers: function() {
        this.canvas.mouseenter = _.bind(this.handle_mouseenter, this);
        this.canvas.mouseout = _.bind(this.handle_mouseout, this);

        this.canvas.onmousedown = _.bind(this.handle_mousedown, this);
        this.canvas.onmouseup = _.bind(this.handle_mouseup, this);
        this.canvas.onmousemove = _.bind(this.handle_mouse_move, this);
    },

    pick_render: function() {
        var gl = this.gl;
        gl.viewport(0, 0, this.viewport_width, this.viewport_height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        this.programs.line_render.execute(
            this.framebuffers.pos_1.unit,
            this.render_data.line_points,
            this.viewport_width,
            this.viewport_height);

        this.programs.circle_render.execute(
            this.framebuffers.pos_1.unit,
            this.render_data.node_points,
            this.viewport_width,
            this.viewport_height);

        gl.disable(gl.BLEND);
        gl.flush();
    },

    render: function() {
        var gl = this.gl;
        gl.viewport(0, 0, this.viewport_width, this.viewport_height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        this.programs.line_render.execute(
            this.framebuffers.pos_1.unit,
            this.render_data.line_points,
            this.viewport_width,
            this.viewport_height);

        this.programs.circle_render.execute(
            this.framebuffers.pos_1.unit,
            this.render_data.node_points,
            this.viewport_width,
            this.viewport_height);

        gl.disable(gl.BLEND);
        gl.flush();
    },

    switch_fbo: function() {
        var tmp_fbo = this.framebuffers.pos_1.fbo;
        this.framebuffers.pos_1.fbo = this.framebuffers.pos_0.fbo;
        this.framebuffers.pos_0.fbo = tmp_fbo;

        var tmp_unit = this.framebuffers.pos_1.unit;
        this.framebuffers.pos_1.unit = this.framebuffers.pos_0.unit;
        this.framebuffers.pos_0.unit = tmp_unit;
    },

    zoom_in: function() {
        var new_scale = this.camera_scale / 2.0;
        if (new_scale < 64.0) {
            new_scale = 64.0;
        }
        this.camera_scale = new_scale;
        this.programs.circle_render.camera_scale = new_scale;
        this.programs.line_render.camera_scale = new_scale;
    },

    zoom_out: function() {
        var new_scale = this.camera_scale * 2.0;
        if (new_scale > 65536.0) {
            new_scale = 65536.0;
        }
        this.camera_scale = new_scale;
        this.programs.circle_render.camera_scale = new_scale;
        this.programs.line_render.camera_scale = new_scale;
    }
};

Carambola.internal_methods = {

};

Carambola.createVisFn = function(config) {
    // Utility functions
    // =================
    var zero_array = function(d) {
        var tmp = [];

        for (var i = 0; i < d; i++) {
            tmp.push(0.0);
        }

        return tmp;
    };

    var create_node_position_array32 = function(nodes, p_node_mat_size) {
        var tmp = zero_array(4 * p_node_mat_size * p_node_mat_size);

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            tmp[i * 4 + 0] = n.x; // # x - position.x
            tmp[i * 4 + 1] = n.y; // # y - position.y
            // # z - velocity.x
            // # w - velocity.y
        }

        return new Float32Array(tmp);
    };

    var create_connection_matrix_array32 = function(edges, p_max_nodes) {
        var strengths = zero_array(p_max_nodes * p_max_nodes);
        var lengths = zero_array(p_max_nodes * p_max_nodes);

        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var source = e.source;
            var target = e.target;
            var str = e.strength;
            var len = e.length;

            if (source < p_max_nodes && target < p_max_nodes) {
                strengths[source * p_max_nodes + target] = str; // # x - spring strength
                strengths[target * p_max_nodes + source] = str; // # x - spring strength

                lengths[source * p_max_nodes + target] = len; // # y - spring length
                lengths[target * p_max_nodes + source] = len; // # y - spring length
            }
        }

        var flat = [];
        for (var p = 0; p < p_max_nodes * p_max_nodes; p++) {
            flat.push(strengths[p], lengths[p], 0.0, 0.0);
        }

        return new Float32Array(flat);
    };

    var create_node_property_array32 = function(nodes, p_node_mat_size) {
        var tmp = zero_array(4 * p_node_mat_size * p_node_mat_size);
        var num_nodes = p_node_mat_size * p_node_mat_size;
        var d = 1.0 / num_nodes;
        var link_index = d / 2.0;
        //var link_index = 0.0;

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];

            tmp[4 * i] = n.charge; // x
            // tmp[4 * i + 1] = n.mass; // x
            tmp[4 * i + 2] = link_index; // # z - row / column accessor index for connection matrix texture

            link_index += d;
        }

        return new Float32Array(tmp);
    };

    var make_texture = function(active_tex, texture_data, size_x, size_y, datatype) {
        var tex_obj = gl.createTexture();
        gl.activeTexture(active_tex);
        gl.bindTexture(gl.TEXTURE_2D, tex_obj);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size_x, size_y, 0, gl.RGBA, datatype, texture_data);

        return tex_obj;
    };

    var framebuffer_status_str = function(status) {
        var s;
        switch (status) {
            case gl.FRAMEBUFFER_COMPLETE:
                s = "FRAMEBUFFER_COMPLETE";
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                s = "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                s = "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                s = "FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_FORMATS:
                s = "FRAMEBUFFER_INCOMPLETE_FORMATS";
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                s = "FRAMEBUFFER_UNSUPPORTED";
                break;
        }

        return s;
    };

    var check_fbo_status = function () {
        var fb_status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if( fb_status != gl.FRAMEBUFFER_COMPLETE) {
            console.log("framebuffer not complete: " + framebuffer_status_str(fb_status));
        }
    };

    var create_texture_fbo = function(tex_obj) {
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex_obj, 0);
        check_fbo_status();
        return fbo;
    };

    var create_fake_color_array = function(num_nodes) {
        var fake_color = [0, 0, 0],
            arr = [];

        for (var i = 0; i < num_nodes; ++i) {
            arr.push(fake_color.slice(0));

            fake_color[0] += 1;
            if (fake_color[0] > 255) {
                fake_color[0] = 0;
                fake_color[1] += 1;

                if (fake_color[1] > 255) {
                    fake_color[1] = 0;
                    fake_color[2] += 1;

                    if (fake_color[2] > 255) {
                        fake_color[2] = 0;
                    }
                }
            }
        }

        return arr;
    };

    // End utility functions
    // =====================

    var gpgpu_ctx,
        gl,
        dom_element,
        node_matrix_size,
        node_list,
        edge_list;

    var state_changed = config.onStateChange || function(d) {console.log(d)};

    dom_element = document.getElementById(config.element_id);
    gpgpu_ctx = Object.create(Carambola.GPGPUContext, {});
    gpgpu_ctx.init(dom_element);
    gl = gpgpu_ctx.gl;

    state_changed({
        state: "webgl_context_created",
        msg: ""
    });

    node_matrix_size = config.simulation.node_matrix_size;
    node_list = config.nodes;
    edge_list = config.edges;

    var max_nodes = node_matrix_size * node_matrix_size;


    // Assign a fake color for each node for mouse picking
    // ===================================================


    // Initialize read-only textures
    // =============================
    var node_prop_array32 = create_node_property_array32(node_list, node_matrix_size);
    var connection_matrix_array32 = create_connection_matrix_array32(edge_list, max_nodes);

    var static_textures = {
        node_properties: {
            texture: make_texture(gl.TEXTURE3, node_prop_array32, node_matrix_size, node_matrix_size, gl.FLOAT),
            unit: 3
        },
        connection_matrix: {
            texture: make_texture(gl.TEXTURE2, connection_matrix_array32, max_nodes, max_nodes, gl.FLOAT),
            unit: 2
        }
    };

    // Initialize offscreen frame buffers
    // ==================================

    // x, y - position
    // w, z - velocity
    var node_data_array32 = create_node_position_array32(node_list, node_matrix_size);
    var node_pos_texture_0 = make_texture(gl.TEXTURE0, node_data_array32, node_matrix_size, node_matrix_size, gl.FLOAT);
    var node_pos_texture_1 = make_texture(gl.TEXTURE1, node_data_array32, node_matrix_size, node_matrix_size, gl.FLOAT);

    // k1 force and velocity
    var rk4_k1_force_vel = make_texture(gl.TEXTURE7, null, node_matrix_size, node_matrix_size, gl.FLOAT);
    // k1 force and velocity
    var rk4_k2_force_vel = make_texture(gl.TEXTURE8, null, node_matrix_size, node_matrix_size, gl.FLOAT);
    // k1 force and velocity
    var rk4_k3_force_vel = make_texture(gl.TEXTURE9, null, node_matrix_size, node_matrix_size, gl.FLOAT);
    // k1 force and velocity
    var rk4_k4_force_vel = make_texture(gl.TEXTURE10, null, node_matrix_size, node_matrix_size, gl.FLOAT);

    var framebuffers = {
        pos_0: {
            fbo: create_texture_fbo(node_pos_texture_0),
            unit: 0
        },
        pos_1: {
            fbo: create_texture_fbo(node_pos_texture_1),
            unit: 1
        },
        rk4_k1_force_vel: {
            fbo: create_texture_fbo(rk4_k1_force_vel),
            unit: 7
        },
        rk4_k2_force_vel: {
            fbo: create_texture_fbo(rk4_k2_force_vel),
            unit: 8
        },
        rk4_k3_force_vel: {
            fbo: create_texture_fbo(rk4_k3_force_vel),
            unit: 9
        },
        rk4_k4_force_vel: {
            fbo: create_texture_fbo(rk4_k4_force_vel),
            unit: 10
        }
    };

    var obj = Object.create(Carambola.Visualization, {});

    obj.gl = gpgpu_ctx.gl;
    obj.canvas = dom_element;
    obj.static_textures = static_textures;
    obj.framebuffers = framebuffers;

    obj.viewport_width = config.viewport.width;
    obj.viewport_height = config.viewport.height;

    obj.simulation = {
        node_matrix_size: config.simulation.node_matrix_size,
        drag: config.simulation.drag || 10.0,
        spring_damping: config.simulation.spring_damping || 1.0,
        spring_length_coeff: config.spring_length_coeff || 1.0,
        spring_strength_coeff: config.spring_strength_coeff || 1.0,
        coulomb_coeff: config.coulomb_coeff || 1.0,
        centroid_coeff: config.centroid_coeff || 1.0,
        timestep: config.simulation.timestep || 0.01
    };

    obj.camera_scale = 32.0;

    obj.camera_trans = {
        x: 0.0,
        y: 0.0
    };

    obj.state = {
        mouse_over: false,
        mouse_down: false
    };

    obj.render_data = {
        node_fake_points: Carambola.createNodeFalseColorData(gpgpu_ctx, node_list, node_matrix_size, create_fake_color_array(node_list.length)),
        node_points: Carambola.createNodeVertexData(gpgpu_ctx, node_list, node_matrix_size),
        line_points: Carambola.createLinkVertexData(gpgpu_ctx, node_list, edge_list, node_matrix_size)
    };

    obj.programs = {
        circle_render: Carambola.createCircleShader(gpgpu_ctx),
        line_render: Carambola.createLineShader(gpgpu_ctx),
        force_accumulator: Carambola.createForceAccumulator(gpgpu_ctx, node_matrix_size),
        rk4diff: Carambola.createRK4Derivative(gpgpu_ctx),
        rk4integrator: Carambola.createRK4Integrator(gpgpu_ctx),
        pixelread: Carambola.createPixelReadProgram(gpgpu_ctx),
        arrange: Carambola.createArrangeShader(gpgpu_ctx, {elements: [3, 0, 0, 0]})
    };

    config.onSuccess(obj);
};

Carambola.createVisualization = function(config) {
    _.defer(Carambola.createVisFn, config);
};
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

Carambola.createVertexBuffer = function(gpgpu_context, data) {
    var gl = gpgpu_context.gl;
    var vertex_buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    return vertex_buffer;
};

Carambola.createNodeVertexData = function(gpgpu_context, node_list, node_matrix_size) {
    var d,
        node_points,
        index,
        cnt;

    node_points = [];
    index = 0;
    cnt = 0;
    d = 1.0 / node_matrix_size;
    for (var y = d/2; y < 1; y+= d) {
        for (var x = d/2; x < 1; x+= d) {
            node_points.push( x );
            node_points.push( y );
            node_points.push(node_list[cnt].color[0]);
            node_points.push(node_list[cnt].color[1]);
            node_points.push(node_list[cnt].color[2]);
            node_points.push(10.0);
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

    return {
        vertex_buffer: Carambola.createVertexBuffer(gpgpu_context, node_points),
        length: index
    };
};


Carambola.createNodeFalseColorData = function(gpgpu_context, node_list, node_matrix_size, fake_color_array) {
    var d,
        node_points,
        index,
        cnt,
        fake_color;

    node_points = [];
    index = 0;
    cnt = 0;
    d = 1.0 / node_matrix_size;

    for (var y = d/2; y < 1; y+= d) {
        for (var x = d/2; x < 1; x+= d) {
            fake_color = fake_color_array[cnt];

            node_points.push( x );
            node_points.push( y );
            node_points.push(fake_color[0]);
            node_points.push(fake_color[1]);
            node_points.push(fake_color[2]);
            node_points.push(10.0);
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

    return {
        vertex_buffer: Carambola.createVertexBuffer(gpgpu_context, node_points),
        length: index
    };
};

Carambola.createLinkVertexData = function(gpgpu_context, node_list, edge_list, node_matrix_size) {
    var d,
        node_points,
        edge_points,
        index,
        cnt;

    node_points = [];
    cnt = 0;
    d = 1.0 / node_matrix_size;
    for (var y = d/2; y < 1; y+= d) {
        for (var x = d/2; x < 1; x+= d) {
            node_points.push( x );
            node_points.push( y );
            cnt = cnt + 1;

            if (cnt == node_list.length) {
                break;
            }
        }

        if (cnt == node_list.length) {
            break;
        }
    }

    index = 0;

    edge_points = [];
    for (var i = 0; i < edge_list.length; i++) {
        var e = edge_list[i];
        var source = e.source;
        var x = node_points[2 * source];
        var y = node_points[2 * source + 1];
        edge_points.push(x, y);
        edge_points.push(e.color[0], e.color[1], e.color[2]);

        var target = e.target;
        x = node_points[2 * target];
        y = node_points[2 * target + 1];
        edge_points.push(x, y);
        edge_points.push(e.color[0], e.color[1], e.color[2]);
        index = index + 2;
    }

    return {
        vertex_buffer: Carambola.createVertexBuffer(gpgpu_context, edge_points),
        length: index
    };
};

var Carambola = Carambola || {

};

Carambola.parse_matrix_market_graph = function(mtx) {
    var lines = mtx
            .split(/\n/g)
            .filter(function(d) { return d.charAt(0) != "%"; });

    // Parse the number of nodes from the first line
    var num_nodes = parseInt(lines.slice(0, 1)[0].split(" ")[0]);
    var nodes = [];
    for (var i = 0; i < num_nodes; ++i) {
        nodes.push({
            name: i
        });
    }

    var edges = lines
            .slice(1, -1) // Skip the first line
            .map(function(d) {
                d = d.split(/\s+/g);
                var source = d[0] - 1, target = d[1] - 1, value = d[2] || 1.0;

                return {
                    source: source,
                    target: target,
                    value: 1.0
                };
            });

    return {
        nodes: nodes,
        edges: edges
    };
};

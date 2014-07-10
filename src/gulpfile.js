var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

gulp.task('scripts', function() {
    return gulp.src('app/scripts/**/*.js')
        .pipe($.jshint('.jshintrc'))
        .pipe($.jshint.reporter('default'))
        .pipe($.concat('main.js'))
        .pipe(gulp.dest('dist/scripts'))
        .pipe($.rename({ suffix: '.min' }))
        .pipe($.uglify())
        .pipe(gulp.dest('dist/scripts'))
        .pipe($.notify({ message: 'Scripts task complete' }));
});

/*
gulp.task('traceur', function () {
    var runtimePath = $.traceur.RUNTIME_PATH;
    var filter = $.filter('!traceur-runtime.js');

    return gulp.src([runtimePath, 'webapp/scripts/*.js'])
        .pipe($.order([
            'carambola.js'
        ]))
        .pipe(filter)
        .pipe($.traceur({
            experimental: true,
            // sourceMap: true,
            modules: 'register'
        }))
        .pipe(filter.restore())
        .pipe($.concat('app.js'))
        .pipe($.insert.append('System.get("app" + "");'))
        .pipe(gulp.dest('build'));
});
*/

// Clean
gulp.task('clean', function() {
    return gulp.src(['dist/styles', 'dist/scripts'], {read: false})
        .pipe(clean());
});

// Watch
gulp.task('watch', function() {
    gulp.watch('src/scripts/**/*.js', ['scripts']);

    var server = $.livereload();

    // Watch any files in dist/, reload on change
    gulp.watch(['dist/**']).on('change', function(file) {
        server.changed(file.path);
    });
});

gulp.task('webserver', function() {
    gulp.src('app')
        .pipe($.webserver({
            livereload: true,
            port: 9010,
            fallback: 'index.html'
        }));
});

gulp.task('serve', ['webserver', 'watch']);

gulp.task('default', ['clean'], function() {
    gulp.start('scripts');
});

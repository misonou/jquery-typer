// jshint ignore: start
module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                process: true,
            },
            build: {
                src: ['src/license.js', 'src/{core,presets,ui}.js', 'src/{themes,extensions,presets}/*', 'node_modules/setimmediate/setimmediate.js'],
                dest: 'dist/jquery.typer.js'
            }
        },
        uglify: {
            options: {
                banner: '/*! jQuery Typer Plugin v<%= pkg.version %> | <%= pkg.homepage %> | The MIT License (MIT) */\n',
                sourceMap: true
            },
            build: {
                src: 'dist/jquery.typer.js',
                dest: 'dist/jquery.typer.min.js'
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Default task(s).
    grunt.registerTask('default', ['concat', 'uglify']);

};

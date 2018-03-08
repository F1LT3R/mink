const path = require('path')

const filesys = require('app/lib/core/filesys')

const RoutesConstructor = config => {
	const {log} = config

	const routes = {}

	routes.handlers = {}
	routes.templates = {}
	routes.routeList = []

	routes.moduleLoaders = {
		nodeModule: (MinkconfRoot, name) => {
			try {
				const mod = require(name)
				return mod
			} catch (err) {
				log.error(err)
				return new Error(err)
			}
		},

		localJavaScript: (MinkconfRoot, name) => {
			try {
				const uri = path.join(MinkconfRoot, name)
				const mod = require(uri)
				return mod
			} catch (err) {
				log.error(err)
				throw new Error(err.message)
			}
		}
	}

	// A Node Module name contains no URL characters.
	// Therefore: if the base of a parsed path matches
	// the original name, the user had passed a Node
	// Module and not a relative JavaScript URL into
	// the Minkconf.js file.
	routes.getModuleType = name => {
		const base = path.parse(name).base

		if (base === name) {
			return 'nodeModule'
		}

		return 'localJavaScript'
	}

	routes.loadModule = (MinkconfRoot, name) => {
		const moduleType = routes.getModuleType(name)
		return routes.moduleLoaders[moduleType](MinkconfRoot, name)
	}

	routes.loadTemplate = (MinkconfRoot, file) => {
		try {
			const uri = path.join(MinkconfRoot, file)
			const template = filesys.loadFileSync(uri)
			return template
		} catch (err) {
			log.error(err)
			return false
		}
	}

	if (config &&
		Reflect.has(config, 'MinkconfData') &&
		Reflect.has(config.MinkconfData, 'plugins')
	) {
		config.MinkconfData.plugins.forEach(plugin => {
			routes.routeList.push(plugin)
		})
	}

	routes.constructPlugin = (module, plugin, helpers) => {
		if (typeof plugin !== 'function') {
			const errorMsg = `Plugin ${module} was not a Mink plugin`
			log.fatal(errorMsg)
			throw new Error(errorMsg)
		}

		let callback

		try {
			callback = plugin(helpers)
		} catch (err) {
			const errorMsg = `Plugin ${module} could not be initialized`
			log.fatal(errorMsg, err)
			throw new Error(errorMsg)
		}

		return callback
	}

	routes.routeList.forEach(route => {
		const {
			path: pattern,
			module,
			template,
			tag
		} = route

		const minkHelpers = {
			root: config.MinkconfRoot,
			log
		}

		const plugin = routes.loadModule(config.MinkconfRoot, module)
		const callback = routes.constructPlugin(module, plugin, minkHelpers)

		const handler = {
			module,
			pattern: pattern || null,
			callback,
			tag: tag || null
		}

		if (template) {
			handler.template = routes.loadTemplate(config.MinkconfRoot, template)
		}

		routes.handlers[module] = handler
	})

	return routes
}

module.exports = RoutesConstructor

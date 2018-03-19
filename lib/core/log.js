const path = require('path')
const chalk = require('chalk')
const chromafi = require('chromafi')

/**
 * Log - generates output to console and or file
 * @constructor
 * @param {object} config - the Mink Service config
 */

const MINK_MARK = {
	MONO: 'MINK |',
	COLOR: ' MINK '
}

const LEVEL_PAD = {
/* eslint-disable key-spacing */
	OFF:   '  <off>',
	TRACE: '<trace>',
	DEBUG: '<debug>',
	INFO:  ' <info>',
	WARN:  ' <warn>',
	ERROR: '<error>',
	FATAL: '<fatal>'
}
/* eslint-enable key-spacing */

const LEVELS_ENUM = {
	OFF: 0,
	TRACE: 1,
	DEBUG: 2,
	INFO: 3,
	WARN: 4,
	ERROR: 5,
	FATAL: 6,
	0: 'OFF',
	1: 'TRACE',
	2: 'DEBUG',
	3: 'INFO',
	4: 'WARN',
	5: 'ERROR',
	6: 'FATAL'
}

const applyStyle = styleAry => {
	if (!styleAry) {
		return chalk.reset
	}

	let style = chalk

	styleAry.forEach(prop => {
		style = style[prop]
	})

	return style
}

const decorate = (message, level, style) => {
	let $mark = MINK_MARK.MONO
	let $level = LEVEL_PAD[level]
	let $message = message

	if (style) {
		$mark = style.MARK[level](MINK_MARK.COLOR)
		$level = style.LEVEL[level]($level)
		$message = style.MESSAGE[level](message)

		const colorOutput = `${$mark} ${$level} ${$message}`
		return colorOutput
	}

	const monochromeOutput = `${$mark} ${$level} - ${$message}`
	return monochromeOutput
}

const Log = cli => {
	const log = {
		decorate,
		highlight: chromafi
	}

	log.settings = {
		color: undefined,
		level: {
			console: undefined,
			file: undefined
		},
		styles: undefined
	}

	if (cli && Reflect.has(cli, 'flags')) {
		if (Reflect.has(cli.flags, 'logColor')) {
			log.settings.color = cli.flags.logColor
		}

		if (Reflect.has(cli.flags, 'logLevel')) {
			log.settings.level.console = cli.flags.logLevel
		}

		if (Reflect.has(cli.flags, 'logLevelFile')) {
			log.settings.level.file = cli.flags.logLevelFile
		}
	}

	log.activateStyles = styles => {
		const output = {}

		Reflect.ownKeys(styles).forEach(styleName => {
			if (!Reflect.has(output, styleName)) {
				output[styleName] = {}
			}

			const props = styles[styleName]

			Reflect.ownKeys(props).forEach(propName => {
				if (!Reflect.has(output[styleName], propName)) {
					const styleAry = props[propName]
					const activeStyle = applyStyle(styleAry)
					output[styleName][propName] = activeStyle
				}
			})
		})

		return output
	}

	if (log.settings.color) {
		const stylePath = path.join(__dirname, 'defaults.style.js')
		const loadedStyles = require(stylePath)
		const activeStyles = log.activateStyles(loadedStyles)
		log.settings.styles = activeStyles
	}

	log.toConsole = (message, level, style, ...details) => {
		const messageLevelEnum = LEVELS_ENUM[level]
		const consoleLevelEnum = LEVELS_ENUM[log.settings.level.console]

		if (messageLevelEnum >= consoleLevelEnum) {
			const styles = log.settings.color ? log.settings.styles : null
			const decoratedMessage = log.decorate(message, level, styles)

			const errors = []
			const isError = message instanceof Error
			if (isError) {
				errors.push(message)
			}

			let detailFormatted = ''
			if (details.length > 0) {
				details.forEach(detail => {
					const isError = detail instanceof Error
					if (isError) {
						errors.push(detail)
					}

					if (typeof detail === 'object') {
						const highlighted = log.highlight(detail)
						detailFormatted += `\n${highlighted}\n`
					}
				})
			}

			const output = decoratedMessage + detailFormatted

			// No console output while system under test
			if (!cli.flags.systemUnderTest) {
				if (Reflect.has(console, level)) {
					// eslint-disable-next-line no-console
					console[level](output)
				} else {
					// eslint-disable-next-line no-console
					console.log(output)
				}
			}

			if (errors.length > 0 && cli.flags.systemUnderTest === false) {
				errors.forEach(err => {
					// eslint-disable-next-line no-console
					console.error(err)
				})
			}

			return output
		}
	}

	log.trace = (message, ...details) => {
		log.toConsole(message, 'TRACE', log.settings.color, ...details)
	}

	log.debug = (message, ...details) => {
		log.toConsole(message, 'DEBUG', log.settings.color, ...details)
	}

	log.info = (message, ...details) => {
		log.toConsole(message, 'INFO', log.settings.color, ...details)
	}

	log.warn = (message, ...details) => {
		log.toConsole(message, 'WARN', log.settings.color, ...details)
	}

	log.error = (message, ...details) => {
		log.toConsole(message, 'ERROR', log.settings.color, ...details)
	}

	log.fatal = (message, ...details) => {
		log.toConsole(message, 'FATAL', log.settings.color, ...details)
	}

	return log
}

module.exports = Log


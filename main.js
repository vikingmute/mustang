#!/usr/bin/env node

const fetch = require('node-fetch')
const path = require('path')
const fs = require('fs')
const program = require('commander')
const chalk = require('chalk')
const MultiProgress = require("./multi-progress")
const Enc = require('./crypto')
const querystring = require('querystring')
const NETEASE_API_URL = 'http://music.163.com/weapi'

program
	.version('0.1.3')
	.usage('[options]')
	.option('-i, --id [id]', '设置下载歌单专辑或者单曲的 ID')
	.option('-d, --dir [dir]', '设置下载文件夹路径, 默认为 ./downloads, 请使用绝对地址')
	.option('-t, --type [type]', '设置下载类型 p 代表 歌单，a 代表专辑， s 代表单曲， 默认为单曲')
	.parse(process.argv)

console.log(chalk.bgGreen.bold('欢迎来到Mustang!'))
console.log(chalk.blue('在这里你可以快速下载网易云音乐的单曲，专辑或者歌单'))
console.log(chalk.blue('这个小项目是为了为我车上的SD卡里面放音乐而建'))
console.log(chalk.red('本工具所收集的歌曲来源于互联网，转载的目的在于传递更多信息及用于网络分享，并不代表本人赞同其观点和对其真实性负责，也不构成任何其他建议'))

function mkdirSync(dirPath) {
	try {
		fs.mkdirSync(dirPath)
	} catch (err) {
		if (err.code !== 'EEXIST') throw err
	}
}


let DOWNLOADS_DIR = ''
if (!program.dir) {
	//create default dir
	const DEFAULT_FOLDER = path.join(process.cwd(), 'downloads')
	mkdirSync(DEFAULT_FOLDER)
	DOWNLOADS_DIR = DEFAULT_FOLDER
} else {
	DOWNLOADS_DIR = program.dir
}
let TYPE = program.type || 's'
let AID = 0

if (!program.id) {
	console.log(chalk.red('请提供对应的ID'))
	process.exit(1)
} else {
	AID = program.id
}

const FILE_DOWNLOAD_TIMEOUT = 60000
const BARS = {}
const multi = new MultiProgress(process.stderr)

const NeteaseRequest = (url, query) => {
	let opts = {
		mode: 'no-cors',
		method: 'POST',
		headers: {
			'Origin': 'http://music.163.com',
			'Referer': 'http://music.163.com',
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		credentials: 'include'
	};
	opts.body = querystring.stringify(query)
	return new Promise((resolve, reject) => {
		fetch(NETEASE_API_URL + url, opts)
			.then(res => res.json())
			.then(json => resolve(json))
			.catch(err => reject(err))
	})
}

const getSongInfo = (id) => {
	let opts = {
		mode: 'no-cors',
		method: 'GET',
		headers: {
			'Origin': 'http://music.163.com',
			'Referer': 'http://music.163.com'
		},
		credentials: 'include'
	}
	let	url = `http://music.163.com/api/song/detail/?id=${id}&ids=%5B${id}%5D`
	return fetch(url, opts).then(res => {
		if (res.status >= 400) {
			process.exit(1)
		}
		return res.json()
	})
}

const downloadFile = (name, url, destPath) => {
	return fetch(url)
	.then((res) => {
		if (res.ok) {
			return res
		} else {
			Promise.reject({reason: 'Initial error downloading file', meta: {url, error: res.error}})
		}
	})
	.then((resp) => new Promise((res, rej) => {
		const stream = fs.createWriteStream(destPath)
		let timer
		let len
		let bar
		resp.body
			.on('data', (chunk) => {
				if (bar && bar.tick) {
					bar.tick(chunk.length, {name: name});
				}
			})
		resp.body.pipe(stream)
			.on('open', () => {
				console.log(chalk.blue(`开始下载文件 ${chalk.yellow(name)}`))
				len = parseInt(resp.headers.get('content-length'), 10);
				bar = multi.newBar(':name 下载中 [:bar] :percent :etas', {
					complete: '=',
					incomplete: ' ',
					width: 30,
					total: len,
						})

				timer = setTimeout(() => {
					stream.close()
					rej({reason: 'Timed out downloading file', meta: {url}})
				}, FILE_DOWNLOAD_TIMEOUT)
			})
			.on('error', (error) => {
				clearTimeout(timer)
				rej({reason: 'Unable to download file', meta: {url, error}})
			})
			.on('finish', () => {
				clearTimeout(timer)
				res(destPath)
			})
	}))
}
const processDownload = (track) => {
	let filepath = path.join(DOWNLOADS_DIR, track.name + '.mp3')
	fs.openSync(filepath, 'w')
	downloadFile(track.name, track.url, filepath).then(destPath => {
		let dtime = setTimeout(() => {
			console.log('\n')
			console.log(chalk.green(`文件 ${chalk.yellow(track.name)} 已经下载完毕， 文件位置 ${destPath}`))
			clearTimeout(dtime)
		}, 300)
	}, error => {
		console.log(chalk.red(error))
	}).catch(e => {
		console.error(e)
	})
}

const getSong = (id, raw = false, br = 320000) => {
	id = id.split('.').map(i => parseInt(i))
	let obj = {
		'ids': id,
		'br': br,
		'csrf_token': ''
	}
	let encData = Enc.aesRsaEncrypt(JSON.stringify(obj))
	if(raw){
		return NeteaseRequest(`/song/enhance/player/url?csrf_token=`, encData)
	}
	return new Promise((resolve, reject) => {
		NeteaseRequest(`/song/enhance/player/url?csrf_token=`, encData)
			.then(res => {
				if(!res.data[0].url){
					reject({
						success: false,
						message: '网易 - 歌曲需要付费或者ID错误!'
					})
				}
				resolve({
					success: true,
					url: res.data[0].url
				})
			})
			.catch(err => reject({
				err: err,
				success: false,
				message: '网易 - 歌曲需要付费或者ID错误!'
			}))
	});
}

const getAlbum = (id, raw) => {
	let obj = {
		'csrf_token': ''
	};
	let encData = Enc.aesRsaEncrypt(JSON.stringify(obj));
	if(raw){
		return NeteaseRequest(`/v1/album/${id}?csrf_token=`, encData);
	}
	return new Promise((resolve, reject) => {
		NeteaseRequest(`/v1/album/${id}?csrf_token=`, encData)
			.then(res => {
				let ab = res.songs;
				let songList = ab.map(item => {
					return {
						id: item.id,
						name: item.name,
						needPay: item.fee > 0 ? true : false,
						offlineNow: item.privilege.st < 0 ? true : false,
						artists: item.ar,
						album: {
							id: res.album.id,
							name: res.album.name,
							cover: res.album.picUrl.replace('http://', 'https://') + '?param=250y250',
							coverBig: res.album.picUrl.replace('http://', 'https://') + '?param=400y400',
							coverSmall: res.album.picUrl.replace('http://', 'https://') + '?param=140y140',
						}
					}
				});
				let obj = {
					success: true,
					name: res.album.name,
					id: res.album.id,
					cover: res.album.picUrl.replace('http://', 'https://') + '?param=250y250',
					coverBig: res.album.picUrl.replace('http://', 'https://') + '?param=400y400',
					coverSmall: res.album.picUrl.replace('http://', 'https://') + '?param=140y140',
					needPay: songList[0].needPay,
					offlineNow: songList[0].offlineNow,
					artist: {
						name: res.album.artist.name,
						id: res.album.artist.id
					},
					songList: songList
				};
				resolve(obj);
			})
			.catch(err => reject({
				success: false,
				message: err
			}))
	});
}

const getPlaylist = (id, raw) => {
	let obj = {
		id,
		n: 1000,
		'csrf_token': ''
	};
	let encData = Enc.aesRsaEncrypt(JSON.stringify(obj));
	if(raw){
		return NeteaseRequest(`/v3/playlist/detail?csrf_token=`, encData);
	}
	return new Promise((resolve, reject) => {
		NeteaseRequest(`/v3/playlist/detail?csrf_token=`, encData)
			.then(res => {
				try {
					let songList = res.playlist.tracks.map((item, index) => {
						return {
							id: item.id,
							name: item.name,
							artists: item.ar,
							needPay: item.fee > 0 ? true : false,
							offlineNow: res.privileges[index].st < 0 ? true : false,
							album: {
								id: item.al.id,
								cover: item.al.picUrl.replace('http://', 'https://') + '?param=250y250',
								coverBig: item.al.picUrl.replace('http://', 'https://') + '?param=400y400',
								coverSmall: item.al.picUrl.replace('http://', 'https://') + '?param=140y140',
								name: item.al.name
							}
						};
					});
					let obj = {
						success: true,
						name: res.playlist.name,
						id: id,
						cover: null,
						author: {
							id: res.playlist.creator.userId,
							name: res.playlist.creator.nickname,
							avatar: res.playlist.creator.avatarUrl
						},
						songList: songList
					};
					resolve(obj);
				} catch (e) {
					console.log(e);
					reject({
						success: false,
						message: 'your netease playlist id is not correct or data mapping is not correct, try query with raw=true'
					})
				}
			})
			.catch(err => reject({
				success: false,
				message: err
			}))
	});
}

const processSingleSong = (id, raw = true) => {
	return getSongInfo(id).then(songInfo => {
		return getSong(id, false, 320000).then(data => {
			const finalData = Object.assign({}, songInfo.songs[0], data)
			return finalData
		})
	}).then(track => {
		console.log(chalk.blue(`解析到歌曲 ${chalk.yellow(track.name)}`))
		processDownload(track)
	}).catch(err => {
		console.error(err)
	})
}
const processSongInAlbum = (track) => {
	return getSong(track.id + '' , false, 320000).then(data => {
		const newTrack = Object.assign({}, track, data)
		return newTrack
	}).then(newTrack => {
		console.log(chalk.blue(`解析到歌曲 ${chalk.yellow(newTrack.name)}`))
		processDownload(newTrack)
	}).catch(err => {
		console.error(err)
	})
}

const processAlbum = (id) => {
	return getAlbum(id).then(albumInfo => {
		const promises = albumInfo.songList.map(song => {
			return processSongInAlbum(song)
		})
		return Promise.all(promises)
	}).catch(err => {
		console.error(err)
	})
}

const processPlaylist = (id) => {
	return getPlaylist(id).then(playlistInfo => {
		const promises = playlistInfo.songList.map(song => {
			return processSongInAlbum(song)
		})
		return Promise.all(promises)
	}).catch(err => {
		console.error(err)
	})
}
if (TYPE === 'p') {
	processPlaylist(AID)
} else if (TYPE === 'a') {
	processAlbum(AID)
} else {
	processSingleSong(AID)
}

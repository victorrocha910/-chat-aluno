const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const path = require('path')

const app = express()

const USUARIO_ADMIN = 'admin'
const SENHA_ADMIN = '1234'

let usuarios = []
let mensagens = []

app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static('public'))

app.use(session({
    secret: 'minha-chave-secreta-123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1800000 }
}))

app.get('/login', function(req, res) {
    let html = fs.readFileSync('./views/login.html', 'utf8')
    res.send(html)
})

app.post('/login', function(req, res) {
    let usuario = req.body.usuario
    let senha = req.body.senha

    if (usuario == USUARIO_ADMIN && senha == SENHA_ADMIN) {
        req.session.logado = true
        req.session.usuario = usuario

        let agora = new Date()
        let dataFormatada = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR')
        res.cookie('ultimoAcesso', dataFormatada, { maxAge: 999999999 })

        res.redirect('/menu')
    } else {
        let html = fs.readFileSync('./views/login.html', 'utf8')
        html = html.replace('<!-- ERRO -->', '<p style="color:red">Usuário ou senha incorretos!</p>')
        res.send(html)
    }
})

app.get('/menu', function(req, res) {
    if (!req.session.logado) {
        res.redirect('/login')
        return
    }

    let ultimoAcesso = req.cookies.ultimoAcesso
    if (!ultimoAcesso) {
        ultimoAcesso = 'Primeiro acesso'
    }

    let html = fs.readFileSync('./views/menu.html', 'utf8')
    html = html.replace('<!-- ULTIMO_ACESSO -->', ultimoAcesso)
    res.send(html)
})

app.get('/cadastroUsuario.html', function(req, res) {
    if (!req.session.logado) {
        res.redirect('/login')
        return
    }

    let html = fs.readFileSync('./views/cadastroUsuario.html', 'utf8')
    res.send(html)
})

app.post('/cadastrarUsuario', function(req, res) {
    if (!req.session.logado) {
        res.redirect('/login')
        return
    }

    let nome = req.body.nome
    let dataNasc = req.body.dataNasc
    let apelido = req.body.apelido
    let assunto = req.body.assunto

    let erros = ''

    if (!nome || nome.trim() == '') {
        erros += '<li>Nome é obrigatório</li>'
    }
    if (!dataNasc || dataNasc.trim() == '') {
        erros += '<li>Data de nascimento é obrigatória</li>'
    }
    if (!apelido || apelido.trim() == '') {
        erros += '<li>Apelido é obrigatório</li>'
    }
    if (!assunto || assunto == '') {
        erros += '<li>Escolha um assunto</li>'
    }

    if (erros != '') {
        let html = fs.readFileSync('./views/cadastroUsuario.html', 'utf8')
        html = html.replace('<!-- ERROS -->', '<ul style="color:red">' + erros + '</ul>')
        res.send(html)
        return
    }

    let novoUsuario = {
        nome: nome.trim(),
        dataNasc: dataNasc,
        apelido: apelido.trim(),
        assunto: assunto
    }
    usuarios.push(novoUsuario)

    let linhasTabela = ''
    for (let i = 0; i < usuarios.length; i++) {
        let u = usuarios[i]
        linhasTabela += '<tr>'
        linhasTabela += '<td>' + u.nome + '</td>'
        linhasTabela += '<td>' + u.dataNasc + '</td>'
        linhasTabela += '<td>' + u.apelido + '</td>'
        linhasTabela += '<td>' + u.assunto + '</td>'
        linhasTabela += '</tr>'
    }

    let html = fs.readFileSync('./views/listaUsuarios.html', 'utf8')
    html = html.replace('<!-- LINHAS_TABELA -->', linhasTabela)
    res.send(html)
})

app.get('/batepapo', function(req, res) {
    if (!req.session.logado) {
        res.redirect('/login')
        return
    }

    let assuntoEscolhido = req.query.assunto

    if (!assuntoEscolhido) {
        let html = fs.readFileSync('./views/batepapo.html', 'utf8')
        html = html.replace('<!-- MENSAGENS -->', '')
        html = html.replace('<!-- FORM_MENSAGEM -->', '')
        html = html.replace('<!-- ERRO_CHAT -->', '')
        res.send(html)
        return
    }

    let msgDoAssunto = ''
    for (let i = 0; i < mensagens.length; i++) {
        let m = mensagens[i]
        if (m.assunto == assuntoEscolhido) {
            msgDoAssunto += '<div class="msg-box">'
            msgDoAssunto += '<span class="msg-de">' + m.de + '</span>'
            msgDoAssunto += ' <span class="msg-seta">→</span> '
            msgDoAssunto += '<span class="msg-para">' + m.para + '</span>'
            msgDoAssunto += '<span class="msg-hora"> [' + m.hora + ']</span>'
            msgDoAssunto += '<p class="msg-texto">' + m.texto + '</p>'
            msgDoAssunto += '</div>'
        }
    }

    if (msgDoAssunto == '') {
        msgDoAssunto = '<p class="sem-msg">Nenhuma mensagem ainda nesse assunto.</p>'
    }

    let opcoesUsuarios = '<option value="">Selecione um usuário...</option>'
    for (let i = 0; i < usuarios.length; i++) {
        let u = usuarios[i]
        if (u.assunto == assuntoEscolhido) {
            opcoesUsuarios += '<option value="' + u.apelido + '">' + u.apelido + ' (' + u.nome + ')</option>'
        }
    }

    let formMsg = `
        <div class="form-chat">
            <h3>Enviar mensagem</h3>
            <form method="POST" action="/postarMensagem">
                <input type="hidden" name="assunto" value="${assuntoEscolhido}">
                <label>Para:</label><br>
                <select name="para">${opcoesUsuarios}</select><br><br>
                <label>Mensagem:</label><br>
                <textarea name="texto" rows="3" placeholder="Digite sua mensagem..."></textarea><br><br>
                <button type="submit">Enviar</button>
            </form>
        </div>
    `

    let erroChat = req.session.erroChat || ''
    req.session.erroChat = ''

    let erroHtml = ''
    if (erroChat != '') {
        erroHtml = '<p style="color:red">' + erroChat + '</p>'
    }

    let html = fs.readFileSync('./views/batepapo.html', 'utf8')
    html = html.replace('<!-- MENSAGENS -->', '<h3>Mensagens - ' + assuntoEscolhido + '</h3>' + msgDoAssunto)
    html = html.replace('<!-- FORM_MENSAGEM -->', formMsg)
    html = html.replace('<!-- ERRO_CHAT -->', erroHtml)
    html = html.replace('value="' + assuntoEscolhido + '"', 'value="' + assuntoEscolhido + '" selected')

    res.send(html)
})

app.post('/postarMensagem', function(req, res) {
    if (!req.session.logado) {
        res.redirect('/login')
        return
    }

    let assunto = req.body.assunto
    let para = req.body.para
    let texto = req.body.texto

    if (!para || para == '') {
        req.session.erroChat = 'Você precisa selecionar um usuário!'
        res.redirect('/batepapo?assunto=' + assunto)
        return
    }

    if (!texto || texto.trim() == '') {
        req.session.erroChat = 'A mensagem não pode estar vazia!'
        res.redirect('/batepapo?assunto=' + assunto)
        return
    }

    let agora = new Date()
    let hora = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR')

    let novaMensagem = {
        assunto: assunto,
        de: 'Admin',
        para: para,
        texto: texto.trim(),
        hora: hora
    }
    mensagens.push(novaMensagem)

    res.redirect('/batepapo?assunto=' + assunto)
})

app.get('/logout', function(req, res) {
    req.session.destroy()
    res.redirect('/login')
})

app.get('/', function(req, res) {
    res.redirect('/login')
})

app.listen(3000, function() {
    console.log('=================================')
    console.log('Acesse: http://localhost:3000')
    console.log('Usuario: admin')
    console.log('Senha: 1234')
    console.log('=================================')
})

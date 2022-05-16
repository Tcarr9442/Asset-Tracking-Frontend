import React, { useState, useEffect } from 'react'
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from '@azure/msal-common';
import CookieConsent from 'react-cookie-consent-notification';
import ParticlesElement from '../Components/Particles';
import { ReactComponent as Logo } from '../MDcentricLogo.svg'
import UserService from '../Services/User'
import * as timeago from 'timeago.js';
import '../css/Page-Template.css';

function PageTemplate(props) {
    // Constants for User
    const { instance, accounts } = useMsal()
    const permissions = props.permissions
    const isAdmin = props.isAdmin
    const accent = localStorage.getItem('accentColor') || '#00c6fc'

    // States
    const [SideBarExpanded, setSideBarExpanded] = useState({
        tracking: localStorage.getItem('tracking') === '1' || false,
        reports: localStorage.getItem('reports') === '1' || false,
        tools: localStorage.getItem('tools') === '1' || false,
        parts: localStorage.getItem('parts') === '1' || false
    })
    const [Notifications, setNotifications] = useState({ unread: [], read: [] })
    const [DropDownOpened, setDropDownOpened] = useState(0) //0=none, 1=notification, 2=profile
    // const [sideNavOpen, setSideNavOpen] = useState(localStorage.getItem('sideNavOpen') === '1' || false)

    // React Effects
    useEffect(() => {
        getNotifications()
        let int = setInterval(getNotifications, 15000)
        return () => clearInterval(int)
    }, [])
    useEffect(() => {
        let func = e => { if (!getClassChain(e.target).includes('isdropdown')) setDropDownOpened(0) }
        window.addEventListener('mousedown', func)
        return () => { window.removeEventListener('mousedown', func) }
    }, [])

    // Functions
    async function getTokenSilently() {
        const SilentRequest = { scopes: ['User.Read', 'TeamsActivity.Send'], account: instance.getAccountByLocalId(accounts[0].localAccountId), forceRefresh: true }
        let res = await instance.acquireTokenSilent(SilentRequest)
            .catch(async er => {
                if (er instanceof InteractionRequiredAuthError) {
                    return await instance.acquireTokenPopup(SilentRequest)
                } else {
                    console.log('Unable to get token')
                }
            })
        return res.accessToken
    }

    async function getNotifications() {
        let token = await getTokenSilently()
        let res = await UserService.getNotifications(token)
        if (res.isErrored) console.log(res.error)
        else setNotifications(res.data)
    }

    const clickHandler = async () => {
        let search = document.getElementById('search').value
        if (!search) return
        if (props.setSearch) props.setSearch(search)
        props.history.push(`/search?q=${search}`)
    }

    const handleKeyDown = e => {
        if (e.key === 'Enter') clickHandler()
    }

    const LogoutHandler = async () => {
        instance.logoutPopup({
            postLogoutRedirectUri: "/",
            mainWindowRedirectUri: "/"
        })
        localStorage.setItem('isVerified', null)
    }

    const handleExpandLi = (e, cat) => {
        let t = { ...SideBarExpanded }
        t[cat] = !t[cat]
        localStorage.setItem(cat, t[cat] ? '1' : '0')
        setSideBarExpanded(t)
    }

    const checkForImportantNotification = () => {
        for (let i of Notifications.unread) if (i.important) return true
        for (let i of Notifications.read) if (i.important) return true
        return false
    }

    const handleTogglePriority = async (id) => {
        let t = await getTokenSilently()
        await UserService.flagNotificationImportant({ id }, t)
        getNotifications()
    }

    const handleNotificationClose = async (id) => {
        let t = await getTokenSilently()
        await UserService.closeNotification({ id }, t)
        getNotifications()
    }

    const handleReadingNotifications = async () => {
        if (!Notifications.unread.length) return
        let t = await getTokenSilently()
        let ids = Notifications.unread.map(n => n.id)
        UserService.readNotifications({ ids }, t)
    }

    // Renderers
    const renderNotification = (n) => {
        console.log(n)
        return <div className='Notification' onClick={() => { if (n.url) window.open(n.url, '_blank') }} style={{ cursor: n.url ? 'pointer' : 'initial', backgroundColor: n.important ? '#e8533c' : n.color || accent }}>
            <div className='NotificationTitleRow'>
                <span className='ProfileSection' style={{ cursor: 'inherit' }}>
                    {n.image ? <img src={n.image} alt={n.title} width='50' height='50' style={{ margin: 0, padding: 0 }} /> : undefined}
                    <h4 style={{ paddingRight: 0 }}>{n.title}</h4>
                    {n.important ? <i className='material-icons' style={{ padding: 0 }}>priority_high</i> : undefined}
                </span>
                <div className='DateAndManagementGroup'>
                    <div className='NotificationManagementRow'>
                        <i className='material-icons menuContext' onClick={() => handleTogglePriority(n.id)}>priority_high</i>
                        <i className='material-icons menuContext' onClick={() => handleNotificationClose(n.id)}>close</i>
                    </div>
                    {n.date ? <h5>{timeago.format(n.date)}</h5> : undefined}
                </div>
            </div>
            <div className='break' />
            <h5 style={{ textAlign: 'left' }}>{n.message}</h5>
        </div>
    }

    return (
        <div className="App">
            <ParticlesElement {...props} color={accent} />
            <CookieConsent background={'#000'} color={'#fff'}>Like every other website, this site uses cookies :)</CookieConsent>
            {props.disableHeader ? undefined : <div className='Header'>
                <div className="SearchBox" style={{ margin: '1rem' }}>
                    <input className="searchInput" type="text" id='search' placeholder="Search" onKeyDown={handleKeyDown} />
                    <button className="searchButton" onClick={clickHandler}>
                        <i className="material-icons">search</i>
                    </button>
                </div>
                <div className='IconGroup isDropDown'>
                    <div>
                        <i className='material-icons NotificationSelection' style={{ cursor: 'pointer', color: Notifications.unread.length || checkForImportantNotification() ? accent : '#fff' }} onClickCapture={() => { setDropDownOpened(1); handleReadingNotifications() }}>{checkForImportantNotification() ? 'notification_important' : Notifications.unread.length ? 'notifications_active' : 'notifications'}</i>
                        {DropDownOpened === 1 ? <div className='HeaderDropDown' style={{ right: '8rem' }}>
                            <span className='inlineText'><h5>You have </h5><h5 style={{ color: accent }}>{Notifications.unread.length}</h5><h5> new notifications</h5></span>
                            <hr style={{ width: '496px' }} />
                            {Notifications.unread.map(m => renderNotification(m))}
                            {Notifications.read.length && Notifications.unread.length ?
                                <span style={{ display: 'flex', alignItems: 'center', padding: '0' }}>
                                    <hr style={{ width: '220px', height: '0' }} /><h5 style={{ padding: '4px' }}>Read</h5><hr style={{ width: '220px', height: '0' }} />
                                </span> : undefined}
                            {Notifications.read.map(m => renderNotification(m))}
                        </div> : undefined}
                    </div>
                    <div>
                        <span className='ProfileSection' onClick={() => setDropDownOpened(2)}>
                            <i className='material-icons'>account_circle</i>
                            <h3 style={{ marginLeft: '6px' }}>{accounts[0] ? accounts[0].name : ''}</h3>
                        </span>
                        {DropDownOpened === 2 ? <div className='HeaderDropDown'>
                            <h5>Welcome{accounts[0] ? `, ${accounts[0].name.split(' ')[0]}` : ''}!</h5>
                            <hr />
                            <span className='ProfileSection' onClick={() => LogoutHandler()} style={{ paddingLeft: 0 }}>
                                <i className='material-icons'>logout</i>
                                <h4>Logout</h4>
                            </span>
                        </div> : undefined}
                    </div>
                </div>
            </div>}
            <div className='SideBar'>
                <span style={{ justifyContent: 'space-between', padding: '1vw' }}>
                    <Logo />
                    {/* <i className='material-icons' style={{ cursor: 'pointer' }} onClickCapture={() => { localStorage.setItem('sideNavOpen', !sideNavOpen ? '1' : '0'); setSideNavOpen(!sideNavOpen) }}>{sideNavOpen ? 'format_align_right' : 'format_align_center'}</i> */}
                </span>
                <ul>
                    <li onClickCapture={(e) => props.history.push('/')} >
                        <span>
                            <i className='material-icons' style={{ color: props.highLight === 'home' ? accent : 'white' }}>home</i>
                            <p style={{ color: props.highLight === "home" ? accent : 'white' }} >Home</p>
                        </span>
                    </li>
                    {isAdmin || (permissions && (permissions.use_asset_tracker || permissions.use_hourly_tracker || permissions.use_repair_log)) ?
                        <li onClick={e => handleExpandLi(e, 'tracking')} >
                            <span style={{ justifyContent: 'space-between' }} >
                                <span style={{ padding: 0 }} >
                                    <i className='material-icons' style={{ color: ['asset', 'hourly', 'repair_log'].includes(props.highLight) ? accent : 'white' }}>edit</i>
                                    <p style={{ color: ['asset', 'hourly', 'repair_log'].includes(props.highLight) ? accent : 'white' }}>tracking</p>
                                </span>
                                <i className='material-icons DropDownArrow'>{SideBarExpanded.tracking ? 'expand_more' : 'expand_less'}</i>
                            </span>

                            <ul className={`DropDown${SideBarExpanded.tracking ? ' Show' : ''}`} id='TrackingUL'>
                                {isAdmin || (permissions && permissions.use_asset_tracker) ? <li>
                                    <p style={{ color: props.highLight === "asset" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/asset')}>Asset</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.use_hourly_tracker) ? <li>
                                    <p style={{ color: props.highLight === "hourly" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/hourly')}>Hourly</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.use_repair_log) ? <li>
                                    <p style={{ color: props.highLight === "repair_log" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/repair')}>Repair</p>
                                </li> : <></>}
                            </ul>
                        </li>
                        : undefined}
                    {isAdmin || (permissions && (permissions.view_reports || permissions.view_assets || permissions.view_models)) ?
                        <li onClick={e => handleExpandLi(e, 'reports')} >
                            <span style={{ justifyContent: 'space-between' }} >
                                <span style={{ padding: 0 }}>
                                    <i style={{ color: ['reports', 'assetpage', 'models'].includes(props.highLight) ? accent : 'white' }} className='material-icons'>insights</i>
                                    <p style={{ color: ['reports', 'assetpage', 'models'].includes(props.highLight) ? accent : 'white' }}>reports</p>
                                </span>
                                <i className='material-icons DropDownArrow'>{SideBarExpanded.reports ? 'expand_more' : 'expand_less'}</i>
                            </span>

                            <ul className={`DropDown${SideBarExpanded.reports ? ' Show' : ''}`} id='ReportUL'>
                                {isAdmin || (permissions && permissions.view_reports) ? <li>
                                    <p style={{ color: props.highLight === "reports" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/reports')}>Users</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_assets) ? <li>
                                    <p style={{ color: props.highLight === "assetpage" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/assets')}>Assets</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_models) ? <li>
                                    <p style={{ color: props.highLight === "models" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/models')}>Models</p>
                                </li> : <></>}
                            </ul>
                        </li>
                        : undefined}
                    {isAdmin || (permissions && (permissions.use_importer || permissions.view_jobcodes || permissions.view_users)) ?
                        <li onClick={e => handleExpandLi(e, 'tools')} >
                            <span style={{ justifyContent: 'space-between' }}>
                                <span style={{ padding: 0 }} >
                                    <i style={{ color: ['importer', 'jobs', 'user', 'admin', 'assetmanagement'].includes(props.highLight) ? accent : 'white' }} className='material-icons'>build</i>
                                    <p style={{ color: ['importer', 'jobs', 'user', 'admin', 'assetmanagement'].includes(props.highLight) ? accent : 'white' }}>tools</p>
                                </span>
                                <i className='material-icons DropDownArrow'>{SideBarExpanded.tools ? 'expand_more' : 'expand_less'}</i>
                            </span>
                            <ul className={`DropDown${SideBarExpanded.tools ? ' Show' : ''}`} id='ToolsUL'>
                                {isAdmin || (permissions && permissions.use_importer) ? <li>
                                    <p style={{ color: props.highLight === "importer" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/importer')}>Importer</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_jobcodes) ? <li>
                                    <p style={{ color: props.highLight === "jobs" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/jobs')}>Job Codes</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_users) ? <li>
                                    <p style={{ color: props.highLight === "user" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/users')}>Users</p>
                                </li> : <></>}
                                {isAdmin ? <li>
                                    <p style={{ color: props.highLight === "admin" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/admin')}>Admin</p>
                                </li> : <></>}
                                {isAdmin ? <li>
                                    <p style={{ color: props.highLight === "assetmanagement" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/adas')}>Asset Info</p>
                                </li> : <></>}
                            </ul>
                        </li>
                        : undefined}
                    {isAdmin || (permissions && (permissions.view_part_inventory || permissions.view_jobcodes)) ?
                        <li onClick={e => handleExpandLi(e, 'parts')} >
                            <span style={{ justifyContent: 'space-between' }} >
                                <span style={{ padding: 0 }}>
                                    <i className='material-icons'>hardware</i>
                                    <p style={{ color: ['part_inventory', 'part_management', 'part_types'].includes(props.highLight) ? accent : 'white' }}>parts</p>
                                </span>
                                <i className='material-icons DropDownArrow'>{SideBarExpanded.parts ? 'expand_more' : 'expand_less'}</i>
                            </span>
                            <ul className={`DropDown${SideBarExpanded.parts ? ' Show' : ''}`} id='PartsUL'>
                                {isAdmin || (permissions && permissions.view_part_inventory) ? <li>
                                    <p style={{ color: props.highLight === "part_inventory" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/inventory')}>Inventory</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_jobcodes) ? <li>
                                    <p style={{ color: props.highLight === "part_management" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/parts')}>Management</p>
                                </li> : <></>}
                                {isAdmin || (permissions && permissions.view_jobcodes) ? <li>
                                    <p style={{ color: props.highLight === "part_types" ? accent : 'white' }} onClickCapture={(e) => props.history.push('/parttypes')}>Types</p>
                                </li> : <></>}
                            </ul>
                        </li>
                        : undefined}
                    <li onClickCapture={(e) => props.history.push('/guide')} >
                        <span>
                            <i style={{ color: props.highLight === "guide" ? accent : 'white' }} className='material-icons'>help</i>
                            <p style={{ color: props.highLight === "guide" ? accent : 'white' }} >guide</p>
                        </span>
                    </li>
                </ul>


                {/* <div className='AccountButton'>
                    <button style={{ backgroundColor: localStorage.getItem('accentColor') || '#003994' }}>{accounts[0] ? accounts[0].name : ''}</button>
                    <div className='AccountDropDown'>
                        <button style={{ backgroundColor: localStorage.getItem('accentColor') || '#003994' }} onClick={() => LogoutHandler()}>Logout</button>
                    </div>
                </div> */}
            </div>
            {/* {
                props.disableHeader ? <></> :
                    <div className="searchBox">
                        <input className="searchInput" type="text" id='search' placeholder="Search" onKeyDown={handleKeyDown} />
                        <button className="searchButton" onClick={clickHandler}>
                            <i className="material-icons">search</i>
                        </button>
                    </div>
            } */}
        </div >
    )
}

export default PageTemplate

function getClassChain(ele) {
    if (!ele || !ele.classList) return []
    let t = []
    for (let i of ele.classList) if (typeof i !== 'string') continue
    else t.push(i.toLowerCase())
    return [...t, ...getClassChain(ele.parentNode)]
}
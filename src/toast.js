import { VsNotification } from 'vuesax-alpha'

export default {
  success(text, title = 'AresRPG') {
    VsNotification({
      flat: true,
      color: 'success',
      title,
      text,
    })
  },
  error(text, title = 'Oh no!', icon = `<i class='bx bxs-bug'></i>`) {
    VsNotification({
      flat: true,
      color: 'danger',
      position: 'bottom-right',
      title,
      text,
      duration: 7000,
      icon,
    })
  },
  info(text, title = 'AresRPG') {
    VsNotification({
      flat: true,
      color: 'primary',
      position: 'bottom-right',
      title,
      text,
    })
  },
}

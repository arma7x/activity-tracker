const APP_VERSION = "1.0.0";
const ACTIVITY_TABLE = 'ACTIVITY_LOGS';
const CATEGORY_TABLE = 'CATEGORIES';

const setAlarm = function(data = {}) {
  var alarmId;
  var date = new Date();
  date.setMinutes(date.getMinutes() + 1);
  console.log(date.toString());
  var addRequest = navigator.mozAlarms.add(date, 'honorTimezone', data);
  addRequest.onsuccess = function(res) {
    alarmId = res.target.result;
    // data['activity_id']
    // localforage.get(ACTIVITY_TABLE) -> data['activity_id'] -> alarm_id;
  };
  addRequest.onerrors = function(err) {
    console.log(err);
  };
}

const pushLocalNotification = function(title, body) {
  window.Notification.requestPermission()
  .then((result) => {
    var notification = new window.Notification(title, {
      body: body,
      requireInteraction: true
    });
    notification.onerror = function(err) {
      console.log(err);
    }
    notification.onclick = function(event) {
      if (window.navigator.mozApps) {
        var request = window.navigator.mozApps.getSelf();
        request.onsuccess = function() {
          if (request.result) {
            notification.close();
            request.result.launch();
          }
        };
      } else {
        window.open(document.location.origin, '_blank');
      }
    }
    notification.onshow = function() {
      // notification.close();
    }
  });
}

window.addEventListener("load", function() {

  navigator.mozSetMessageHandler('alarm', function(mozAlarm) {
    console.log('alarm fired:', mozAlarm, localforage);
    pushLocalNotification('TEST', 'This is testing');
    setAlarm(mozAlarm.data);
  });

  localforage.setDriver(localforage.INDEXEDDB);

  const state = new KaiState({
    [ACTIVITY_TABLE]: {},
    [CATEGORY_TABLE]: {},
  });

  localforage.getItem(ACTIVITY_TABLE)
  .then((db) => {
    if (db == null) {
      db = {};
    }
    state.setState(ACTIVITY_TABLE, db);
  });

  localforage.getItem(CATEGORY_TABLE)
  .then((db) => {
    if (db == null) {
      db = {};
    }
    state.setState(CATEGORY_TABLE, db);
  });

  const dummy = new Kai({
    name: '_dummy_',
    data: {
      title: '_dummy_'
    },
    verticalNavClass: '.dummyNav',
    templateUrl: document.location.origin + '/templates/dummy.html',
    mounted: function() {},
    unmounted: function() {},
    methods: {},
    softKeyText: { left: 'L2', center: 'C2', right: 'R2' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const changelogs = new Kai({
    name: 'changelogs',
    data: {
      title: 'changelogs'
    },
    templateUrl: document.location.origin + '/templates/changelogs.html',
    mounted: function() {
      this.$router.setHeaderTitle('Changelogs');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const categoryEditor = function($router, category = null) {
    $router.push(
      new Kai({
        name: 'categoryEditor',
        data: {
          name: category ? category.name : '',
          color: category ? category.color : '',
        },
        verticalNavClass: '.editorCatNav',
        templateUrl: document.location.origin + '/templates/categoryEditor.html',
        mounted: function() {
          this.$router.setHeaderTitle('Category Editor');
        },
        unmounted: function() {},
        methods: {
          selected: function() {},
          randomColor: function() {
            return "#" + Math.floor(Math.random()*16777215).toString(16);
          },
          submit: function() {
            try {
              var _category = {
                id: category ? category.id : new Date().getTime(),
                name: this.data.name.trim(),
                color: this.data.color.trim(),
              }
              if (_category.name.length === 0 ) {
                $router.showToast('Name is required');
              } else if (_category.color.length === 0 ) {
                $router.showToast('Color is required');
              } else {
                localforage.getItem(CATEGORY_TABLE)
                .then((db) => {
                  if (db == null) {
                    db = {};
                  }
                  db[_category.id] = _category;
                  return localforage.setItem(CATEGORY_TABLE, db);
                })
                .then((new_db) => {
                  $router.showToast(`Successfully ${category ? 'update' : 'add'} ${_category.name}`);
                  state.setState(CATEGORY_TABLE, new_db);
                  $router.pop();
                });
              }
            } catch (e) {
              console.log(e.toString());
              $router.showToast('Error');
            }
          }
        },
        softKeyText: { left: 'Random', center: 'OK', right: 'Back' },
        softKeyListener: {
          left: function() {
            this.setData({ color: this.methods.randomColor() });
          },
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              if (listNav[this.verticalNavIndex]) {
                listNav[this.verticalNavIndex].click();
              }
            }
          },
          right: function() {
            $router.pop();
          }
        },
        softKeyInputFocusText: { left: '', center: '', right: 'Back' },
        softKeyInputFocusListener: {
          left: function() {},
          center: function() {},
          right: function() {
            $router.pop();
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            this.data.name = document.getElementById('name').value;
            this.data.color = document.getElementById('color').value;
            this.navigateListNav(-1);
          },
          arrowRight: function() {},
          arrowDown: function() {
            this.data.name = document.getElementById('name').value;
            this.data.color = document.getElementById('color').value;
            this.navigateListNav(1);
          },
          arrowLeft: function() {},
        }
      })
    );
  }

  const category = new Kai({
    name: '_category_',
    data: {
      title: 'category',
      categories: [],
    },
    verticalNavClass: '.catNav',
    templateUrl: document.location.origin + '/templates/category.html',
    mounted: function() {
      this.$router.setHeaderTitle('Manage Category');
      this.$state.addStateListener(CATEGORY_TABLE, this.methods.listenState);
      this.methods.listenState(this.$state.getState(CATEGORY_TABLE));
    },
    unmounted: function() {
      this.$state.removeStateListener(CATEGORY_TABLE, this.methods.listenState);
    },
    methods: {
      listenState: function(data) {
        const temp = [];
        if (data) {
          for (var x in data) {
            temp.push(data[x]);
          }
          this.setData({ categories: temp });
        }
      },
    },
    softKeyText: { left: 'Edit', center: 'ADD', right: 'Remove' },
    softKeyListener: {
      left: function() {
        if (this.verticalNavIndex > -1 && this.data.categories.length > 0) {
          if (this.data.categories[this.verticalNavIndex]) {
            categoryEditor(this.$router, this.data.categories[this.verticalNavIndex]);
          }
        }
      },
      center: function() {
        categoryEditor(this.$router, null);
      },
      right: function() {
        //delete
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const Home = new Kai({
    name: 'home',
    data: {
      title: 'home',
      empty: true,
      active_tasks: [],
    },
    verticalNavClass: '.homeNav',
    components: [],
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('Activity Tracker');
      const CURRENT_VERSION = window.localStorage.getItem('APP_VERSION');
      if (APP_VERSION != CURRENT_VERSION) {
        this.$router.showToast(`Updated to version ${APP_VERSION}`);
        this.$router.push('changelogs');
        window.localStorage.setItem('APP_VERSION', APP_VERSION);
        return;
      }
    },
    unmounted: function() {},
    methods: {
      load: function(page) {},
      getLeague: function(league) {},
    },
    softKeyText: { left: 'Menu', center: 'SELECT', right: 'Add' },
    softKeyListener: {
      left: function() {
        var menu = [
          {'text': 'Activity History'},
          {'text': 'Manage Category'},
          {'text': 'Reports & Statistics'},
          {'text': 'Changelogs'},
          {'text': 'Exit'},
        ]
        this.$router.showOptionMenu('Menu', menu, 'SELECT', (selected) => {
          if (selected.text === 'Changelogs') {
            this.$router.push('changelogs');
          } else if (selected.text === 'Manage Category') {
            this.$router.push('category');
          } else if (selected.text === 'Exit') {
            window.close();
          }
        }, () => {});
      },
      center: function() {
        if (this.verticalNavIndex > -1 && this.data.matches.length > 0) {
          if (this.data.matches[this.verticalNavIndex]) {
            this.data.matches[this.verticalNavIndex]
          }
        }
      },
      right: function() {
        if (this.verticalNavIndex > -1 && this.data.matches.length > 0) {
          if (this.data.matches[this.verticalNavIndex]) {
            
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0)
          return
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex === listNav.length - 1)
          return
        this.navigateListNav(1);
      },
    }
  });

  const router = new KaiRouter({
    title: 'Activity Tracker',
    routes: {
      'index' : {
        name: 'Home',
        component: Home
      },
      'category' : {
        name: 'category',
        component: category
      },
      'changelogs' : {
        name: 'changelogs',
        component: changelogs
      }
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'activity-tracker',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  document.addEventListener('visibilitychange', function(ev) {
    if (document.visibilityState === 'visible') {
      displayKaiAds();
    }
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then(function(swReg) {
    // console.error('Service Worker Registered');
  })
  .catch(function(error) {
    // console.error('Service Worker Error', error);
  });
}

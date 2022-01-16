const APP_VERSION = "1.0.0";
const ACTIVITY_TABLE = 'ACTIVITY_LOGS';
const CATEGORY_TABLE = 'CATEGORIES';
const DEFAULT_CATEGORY = {'id': 'General', 'name': 'General', 'text': 'General', color: '#320374'};

const setAlarm = function(data = {}) {
  var alarmId;
  var date = new Date();
  date.setMinutes(date.getMinutes() + 1);
  console.log(date.toString());
  var addRequest = navigator.mozAlarms.add(date, 'honorTimezone', data);
  addRequest.onsuccess = (res) => {
    alarmId = res.target.result;
    // data['activity_id']
    // localforage.get(ACTIVITY_TABLE) -> data['activity_id'] -> alarm_id;
  };
  addRequest.onerrors = (err) => {
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
          this.methods.renderSoftKeyLR();
        }
      },
      renderSoftKeyLR: function () {
        if (this.data.categories.length > 0)
          this.$router.setSoftKeyLeftText('Edit') || this.$router.setSoftKeyRightText('Remove');
      }
    },
    softKeyText: { left: '', center: 'ADD', right: '' },
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
        if (this.verticalNavIndex > -1 && this.data.categories.length > 0) {
          if (this.data.categories[this.verticalNavIndex]) {
            const cat = this.data.categories[this.verticalNavIndex];
            this.$router.showDialog('Delete Confirmation', `<span>Are you sure to remove category <b>${cat.name}</b> ? All activities related to this category will be changed to <b>General</b> after this action was executed</span>`, null, 'Yes', () => {
              localforage.getItem(CATEGORY_TABLE)
              .then((db) => {
                if (db == null) {
                  db = {};
                }
                delete db[cat.id];
                return localforage.setItem(CATEGORY_TABLE, db);
              })
              .then((new_db) => {
                this.verticalNavIndex--;
                this.$state.setState(CATEGORY_TABLE, new_db);
                this.$router.showToast(`${cat.name} was deleted`);
              });
            }, 'No', () => {}, ' ', null, () => {
              setTimeout(() => {
                this.methods.renderSoftKeyLR();
              }, 100);
            });
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0)
          return;
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.categories.length - 1)
          return
        this.navigateListNav(1);
      }
    }
  });

  const activitytEditor = function($router, activity = null) {
    const mutable = activity ? activity.finish === 0 : true;
    const categories = [DEFAULT_CATEGORY];
    const loops = state.getState(CATEGORY_TABLE);
    for (var c in loops) {
      loops[c]['text'] = loops[c]['name'];
      categories.push(loops[c]);
    }
    $router.push(
      new Kai({
        name: 'activitytEditor',
        data: {
          description: activity ? activity.description : '',
          category: activity ? activity.category : categories[0],
          reminder: 0,
          mutable: mutable,
          isEdit: activity !== null,
        },
        verticalNavClass: '.editorXtvtNav',
        templateUrl: document.location.origin + '/templates/activitytEditor.html',
        mounted: function() {
          this.$router.setHeaderTitle('Activity Editor');
        },
        unmounted: function() {},
        methods: {
          selectCategory: function() {
            const idx = categories.findIndex((opt) => {
              return opt.text === this.data.category.text;
            });
            this.$router.showSingleSelector('Category', categories, 'Select', (selected) => {
              this.setData({
                description: document.getElementById('description').value,
                reminder: document.getElementById('reminder') ? document.getElementById('reminder').value : 0,
                category: selected
              });
            }, 'Cancel', null, undefined, idx);
          },
          submit: function() {
            const t = new Date();
            var _activity = {
              id: activity ? activity.id : t.getTime(),
              description: this.data.description.trim(),
              category: this.data.category.id,
              alarm_id: activity ? activity.alarm_id : 0,
              start: activity ? activity.start : t.getTime(),
              finish: activity ? activity.finish : 0,
              duration: activity ? activity.duration : 0,
            }
            if (_activity.description.length === 0 ) {
              $router.showToast('Description is required');
              return;
            }
            const minit = parseInt(this.data.reminder);
            if (isNaN(minit) || minit === 0) {
              navigator.mozAlarms.remove(_activity['alarm_id']);
              _activity['alarm_id'] = 0;
              this.methods.pushToDb(_activity);
            } else {
              _activity['alarm_id'] = 1;
              console.log(_activity);
            }
          },
          pushToDb: function(obj) {
            try {
              localforage.getItem(ACTIVITY_TABLE)
              .then((db) => {
                if (db == null) {
                  db = {};
                }
                db[obj.id] = obj;
                return localforage.setItem(ACTIVITY_TABLE, db);
              })
              .then((new_db) => {
                $router.showToast(`Successfully ${activity ? 'update' : 'add'} ${obj.id}`);
                state.setState(ACTIVITY_TABLE, new_db);
                $router.pop();
              });
            } catch (e) {
              console.log(e.toString());
              $router.showToast('Error');
            }
          }
        },
        softKeyText: { left: '', center: 'SELECT', right: 'Back' },
        softKeyListener: {
          left: function() {},
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
            this.data.description = document.getElementById('description').value;
            this.data.reminder = document.getElementById('reminder') ? document.getElementById('reminder').value : 0;
            this.navigateListNav(-1);
          },
          arrowRight: function() {},
          arrowDown: function() {
            this.data.description = document.getElementById('description').value;
            this.data.reminder = document.getElementById('reminder') ? document.getElementById('reminder').value : 0;
            this.navigateListNav(1);
          },
          arrowLeft: function() {},
        }
      })
    );
  }

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
      this.$state.addStateListener(ACTIVITY_TABLE, this.methods.listenState);
      this.methods.listenState(this.$state.getState(ACTIVITY_TABLE));
    },
    unmounted: function() {
      this.$state.removeStateListener(ACTIVITY_TABLE, this.methods.listenState);
    },
    methods: {
      listenState: function(data) {
        console.log(data);
        localforage.getItem(CATEGORY_TABLE)
        .then((categories) => {
          if (categories == null) {
            categories = {};
          }
          categories['General'] = DEFAULT_CATEGORY;
          const temp = [];
          if (data) {
            for (var x in data) {
              const y = data[x];
              if (y['finish'] > 0)
                continue;
              if (categories[y['category']] != null) {
                y['category'] = categories[y['category']];
                y['category']['text'] = y['category']['name'];
              } else {
                y['category'] = categories['General'];
              }
              temp.push(y);
            }
            this.setData({ active_tasks: temp });
            this.methods.renderSoftKeyCenter();
          }
        });
      },
      renderSoftKeyCenter: function () {
        if (this.data.active_tasks.length > 0)
          this.$router.setSoftKeyCenterText('ACTION');
      }
    },
    softKeyText: { left: 'Menu', center: '', right: 'Add' },
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
        if (this.verticalNavIndex > -1 && this.data.active_tasks.length > 0) {
          const xtvt = this.data.active_tasks[this.verticalNavIndex];
          if (xtvt) {
            var menu = [
              {'text': 'Edit'},
              {'text': 'STOP'},
            ]
            this.$router.showOptionMenu('ACTION', menu, 'SELECT', (selected) => {
              if (selected.text === 'Edit') {
                activitytEditor(this.$router, xtvt);
              } else if (selected.text === 'STOP') {
                try {
                  localforage.getItem(ACTIVITY_TABLE)
                  .then((db) => {
                    if (db == null) {
                      db = {};
                    }
                    navigator.mozAlarms.remove(xtvt['alarm_id']);
                    xtvt['category'] = xtvt['category']['id'];
                    xtvt['alarm_id'] = 0;
                    xtvt['finish'] = new Date().getTime();
                    xtvt['duration'] = xtvt['finish'] - xtvt['start'];
                    db[xtvt.id] = xtvt;
                    return localforage.setItem(ACTIVITY_TABLE, db);
                  })
                  .then((new_db) => {
                    this.verticalNavIndex--;
                    this.$router.showToast(`Successfully`);
                    this.$state.setState(ACTIVITY_TABLE, new_db);
                  });
                } catch (e) {
                  console.log(e.toString());
                  this.$router.showToast('Error');
                }
              }
            }, () => {
              setTimeout(() => {
                this.methods.renderSoftKeyCenter();
              }, 100);
            });
          }
        }
      },
      right: function() {
        activitytEditor(this.$router, null);
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0)
          return;
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.active_tasks.length - 1)
          return
        this.navigateListNav(1);
      }
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
    return;
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

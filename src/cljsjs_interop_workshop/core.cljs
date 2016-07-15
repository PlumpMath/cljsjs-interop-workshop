(ns cljsjs-interop-workshop.core
  (:require [mychance]
            ))

(enable-console-print!)

;; if i don't declare these functions in externs file then it won't work due to google closure compiler.

(js/console.log (.bool js/chance))

;; In this case only a 30% likelihood of true, and a 70% likelihood of false.
(js/console.log (.bool js/chance (clj->js {:likelihood 30})))

(js/console.log (.character js/chance))

;; specify a pool and the character will be generated with characters only from that pool.
(js/console.log (.character js/chance (clj->js {:pool "abcdef"})))

;; specify alpha for only an alphanumeric character.
(js/console.log (.character js/chance (clj->js {:alpha true})))

;; return only lowercase alphanumeric (for return uppercase pass this {:casing "upper"})
(js/console.log (.character js/chance (clj->js {:casing "lower"})))

;; return only symbols
(js/console.log (.character js/chance (clj->js {:symbols true})))


;; return a random number by default
(js/console.log (.random js/chance))

;; return floating point number
(js/console.log (.floating js/chance))

;; return a random name
(js/console.log (.name js/chance))


;;--------------------------------

(js/console.log (.sentence js/chance))
(js/console.log (.word js/chance))

(js/console.log (.age js/chance))
(js/console.log (.birthday js/chance))

(js/console.log (.android_id js/chance))
(js/console.log (.apple_token js/chance))
(js/console.log (.bb_pin js/chance))


(js/console.log (.country js/chance))
(js/console.log (.phone js/chance))


(js/console.log (.date js/chance))
(js/console.log (.month js/chance))

(js/console.log (.cc js/chance))
(js/console.log (.euro js/chance))
(js/console.log (.cc_type js/chance))





(println "This text is printed from src/cljsjs-interop-workshop/core.cljs. Go ahead and edit it and see reloading in action.")


;; define your app data so that it doesn't get over-written on reload

(defonce app-state (atom {:text "Hello world!"}))


(defn on-js-reload []
  ;; optionally touch your app-state to force rerendering depending on
  ;; your application
  ;; (swap! app-state update-in [:__figwheel_counter] inc)
  )

/**
 * @fileoverview CHANGE-010 單元測試：批次處理並行化
 * @description
 *   測試 p-queue-compat 的核心功能：
 *   - 並發數控制
 *   - 速率限制
 *   - 錯誤處理
 *
 * @module tests/unit/services/batch-processor-parallel
 * @since CHANGE-010
 */

import PQueue from 'p-queue-compat'

describe('CHANGE-010: Parallel Processing with p-queue-compat', () => {
  describe('Concurrency Control', () => {
    it('should respect concurrency limit of 2', async () => {
      const queue = new PQueue({ concurrency: 2 })
      const runningTasks: number[] = []
      const maxConcurrentObserved: number[] = []

      const tasks = Array(5)
        .fill(null)
        .map((_, i) =>
          queue.add(async () => {
            runningTasks.push(i)
            maxConcurrentObserved.push(runningTasks.length)
            await new Promise((r) => setTimeout(r, 50))
            runningTasks.splice(runningTasks.indexOf(i), 1)
            return i
          })
        )

      const results = await Promise.all(tasks)

      // 驗證所有任務完成
      expect(results).toEqual([0, 1, 2, 3, 4])

      // 驗證最大並發數不超過 2
      const maxConcurrent = Math.max(...maxConcurrentObserved)
      expect(maxConcurrent).toBeLessThanOrEqual(2)
      console.log(`Max concurrent tasks observed: ${maxConcurrent}`)
    })

    it('should respect concurrency limit of 5 (CHANGE-010 default)', async () => {
      const queue = new PQueue({ concurrency: 5 })
      const runningTasks: number[] = []
      const maxConcurrentObserved: number[] = []

      const tasks = Array(10)
        .fill(null)
        .map((_, i) =>
          queue.add(async () => {
            runningTasks.push(i)
            maxConcurrentObserved.push(runningTasks.length)
            await new Promise((r) => setTimeout(r, 30))
            runningTasks.splice(runningTasks.indexOf(i), 1)
            return i
          })
        )

      const results = await Promise.all(tasks)

      expect(results.length).toBe(10)

      const maxConcurrent = Math.max(...maxConcurrentObserved)
      expect(maxConcurrent).toBeLessThanOrEqual(5)
      console.log(`Max concurrent tasks observed: ${maxConcurrent}`)
    })

    it('should process sequentially when concurrency is 1', async () => {
      const queue = new PQueue({ concurrency: 1 })
      const executionOrder: number[] = []

      const tasks = Array(3)
        .fill(null)
        .map((_, i) =>
          queue.add(async () => {
            executionOrder.push(i)
            await new Promise((r) => setTimeout(r, 10))
            return i
          })
        )

      await Promise.all(tasks)

      // 順序處理應該按加入順序執行
      expect(executionOrder).toEqual([0, 1, 2])
    })
  })

  describe('Error Handling with Promise.allSettled', () => {
    it('should continue processing when some tasks fail', async () => {
      const queue = new PQueue({ concurrency: 3 })

      const tasks = [
        queue.add(async () => 'success1'),
        queue.add(async () => {
          throw new Error('Task 2 failed')
        }),
        queue.add(async () => 'success3'),
        queue.add(async () => {
          throw new Error('Task 4 failed')
        }),
        queue.add(async () => 'success5'),
      ]

      const results = await Promise.allSettled(tasks)

      // 驗證所有任務都有結果
      expect(results.length).toBe(5)

      // 驗證成功的任務
      expect(results[0]).toEqual({ status: 'fulfilled', value: 'success1' })
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'success3' })
      expect(results[4]).toEqual({ status: 'fulfilled', value: 'success5' })

      // 驗證失敗的任務
      expect(results[1].status).toBe('rejected')
      expect(results[3].status).toBe('rejected')

      // 計算成功和失敗數量
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failedCount = results.filter((r) => r.status === 'rejected').length

      expect(successCount).toBe(3)
      expect(failedCount).toBe(2)

      console.log(`Success: ${successCount}, Failed: ${failedCount}`)
    })

    it('should preserve error information in rejected promises', async () => {
      const queue = new PQueue({ concurrency: 2 })

      const tasks = [
        queue.add(async () => {
          throw new Error('Specific error message')
        }),
      ]

      const results = await Promise.allSettled(tasks)

      expect(results[0].status).toBe('rejected')
      if (results[0].status === 'rejected') {
        expect(results[0].reason.message).toBe('Specific error message')
      }
    })
  })

  describe('Rate Limiting (intervalCap)', () => {
    it('should respect rate limit of 3 requests per second', async () => {
      const queue = new PQueue({
        concurrency: 10, // 高並發，但受速率限制
        interval: 1000,
        intervalCap: 3, // 每秒最多 3 個
      })

      const startTime = Date.now()
      const completionTimes: number[] = []

      const tasks = Array(6)
        .fill(null)
        .map(() =>
          queue.add(async () => {
            completionTimes.push(Date.now() - startTime)
          })
        )

      await Promise.all(tasks)

      // 分析完成時間
      const firstBatch = completionTimes.slice(0, 3)
      const secondBatch = completionTimes.slice(3, 6)

      console.log('Completion times:', completionTimes)
      console.log('First batch (should be < 100ms):', firstBatch)
      console.log('Second batch (should be >= 900ms):', secondBatch)

      // 前 3 個應該幾乎立即完成（<100ms）
      expect(firstBatch.every((t) => t < 200)).toBe(true)

      // 後 3 個應該等待約 1 秒（>=900ms）
      expect(secondBatch.every((t) => t >= 800)).toBe(true)
    })

    it('should use CHANGE-010 default settings (10 per second)', async () => {
      const queue = new PQueue({
        concurrency: 5,
        interval: 1000,
        intervalCap: 10, // CHANGE-010 預設值
      })

      const startTime = Date.now()
      const tasks = Array(10)
        .fill(null)
        .map(() =>
          queue.add(async () => {
            return Date.now() - startTime
          })
        )

      const times = await Promise.all(tasks)

      // 所有 10 個任務應該在第一秒內完成（因為 intervalCap=10）
      const maxTime = Math.max(...(times as number[]))
      console.log('All 10 tasks completed within:', maxTime, 'ms')

      // 考慮到並發數是 5，可能需要等待
      expect(maxTime).toBeLessThan(1500)
    })
  })

  describe('Queue Status and Pending Count', () => {
    it('should track pending tasks correctly', async () => {
      const queue = new PQueue({ concurrency: 2 })
      const pendingCounts: number[] = []

      // 添加任務但不等待
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          queue.add(async () => {
            pendingCounts.push(queue.pending)
            await new Promise((r) => setTimeout(r, 50))
            return i
          })
        )

      // 立即檢查 pending
      expect(queue.pending).toBeLessThanOrEqual(5)

      await Promise.all(promises)

      // 完成後 pending 應該是 0
      expect(queue.pending).toBe(0)
      console.log('Pending counts during execution:', pendingCounts)
    })
  })

  describe('Performance Comparison: Sequential vs Parallel', () => {
    it('should be faster with parallel processing', async () => {
      const taskDuration = 50 // 每個任務 50ms
      const taskCount = 6

      // 順序處理（concurrency=1）
      const sequentialQueue = new PQueue({ concurrency: 1 })
      const sequentialStart = Date.now()

      await Promise.all(
        Array(taskCount)
          .fill(null)
          .map(() =>
            sequentialQueue.add(async () => {
              await new Promise((r) => setTimeout(r, taskDuration))
            })
          )
      )

      const sequentialTime = Date.now() - sequentialStart

      // 並發處理（concurrency=3）
      const parallelQueue = new PQueue({ concurrency: 3 })
      const parallelStart = Date.now()

      await Promise.all(
        Array(taskCount)
          .fill(null)
          .map(() =>
            parallelQueue.add(async () => {
              await new Promise((r) => setTimeout(r, taskDuration))
            })
          )
      )

      const parallelTime = Date.now() - parallelStart

      console.log(`Sequential (concurrency=1): ${sequentialTime}ms`)
      console.log(`Parallel (concurrency=3): ${parallelTime}ms`)
      console.log(`Speedup: ${((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)}%`)

      // 並發處理應該更快
      expect(parallelTime).toBeLessThan(sequentialTime)

      // 預期 3 倍並發應該接近 3 倍速度
      // 6 個任務 × 50ms = 300ms 順序
      // 6 個任務 / 3 並發 × 50ms = 100ms 並發
      expect(parallelTime).toBeLessThan(sequentialTime * 0.6)
    })
  })
})
